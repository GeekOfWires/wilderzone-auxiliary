// Wilderzone Clan Client - QOL flavor
// HTTPS transport layer (wzClansHttpRequest)
//
// Adapted from the TribesNext Project robot client (login.cs / browser.cs /
// mail.cs, Copyright 2011-2013 TribesNext Project, http://www.tribesnext.com/),
// which serialized raw HTTP/1.1 requests over TCPObject through per-target
// queues. The QOL flavor keeps the same semantics - one request in flight per
// target, the rest queued - but sends them through the QoL patch's
// libcurl-backed HTTPObject, which speaks HTTPS (port 443 implicit; HTTPObject
// does not take a port argument).
// QOL flavor by the Wilderzone project.
//
// Hook contract implemented here (called by the shared, flavor-neutral layers):
//
//   wzClansHttpRequest(%target, %path, %payload)
//      %target  - "session" | "browser" | "mail"
//      %path    - path + query, e.g. "/tn/robot/robot_browser.php?guid=..."
//      %payload - "" means GET; anything else is sent as a POST body
//
//   For every response body line:  wzClansOnLine(%target, %line)
//   On completion (or failure):    wzClansOnDisconnect(%target)
//
//   On failure $WZClans::LastError[%target] is set to a short reason string
//   before wzClansOnDisconnect fires. Nothing in the shared layer currently
//   reads it (failure handling matches the original: session retries via its
//   refresh schedule, browser pops the firewall warning, mail completes as
//   usual) - it is kept for console diagnostics and future use.
//
// HTTPObject behavior on the QoL patch (verified against t2csri/serverList.cs
// and t2csri/ipv4.cs inside clientfiles/base/t2csri.vl2): onLine() receives
// response BODY lines directly - no header priming is needed (the original
// client's "primed" blank-line dance was a raw-TCP artifact and is gone).
//
// Two hard-won rules for driving HTTPObject (both learned from live failures):
//  1. NEVER create or start a new HTTPObject from inside another HTTPObject's
//     callback. The shared session layer issues the browser cert request from
//     within the session object's onLine handler; if the new request is
//     created and started there, it stalls and dies on the failsafe timeout.
//     All queue pumping below therefore happens on zero-delay schedules.
//  2. Send "Connection: close". Without it libcurl keeps the connection alive
//     and onDisconnect may not fire promptly (the original raw-TCP client
//     always sent it).
//
// Object lifetime rule (from the working WhoisVpn HTTPObject client): never
// delete the HTTPObject or do heavy work inside its own network callback -
// hand off on a short schedule instead. All completion/failure paths funnel
// into WZClansHttp::wzClansFinish via %this.schedule(100, ...), and Finish
// deletes the object BEFORE notifying the shared layer, so anything the
// notify chain starts sees a clean slate.

// --------------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------------

function wzClansHttpRequest(%target, %path, %payload)
{
   if (%target !$= "session" && %target !$= "browser" && %target !$= "mail")
   {
      error("WZClans: wzClansHttpRequest called with unknown target \"" @ %target @ "\" - request dropped.");
      return;
   }

   // queue the request (tab-separated; robot paths and payloads never
   // contain tabs - payloads may contain \r\n, which fields tolerate)
   %n = $WZClans::QueueCount[%target] + 0;
   $WZClans::Queue[%target, %n] = %path TAB %payload;
   $WZClans::QueueCount[%target] = %n + 1;

   // arm the pump on a zero-delay schedule so the HTTPObject is never created
   // from inside another HTTPObject's callback (rule 1 above)
   if (!$WZClans::Active[%target])
   {
      $WZClans::Active[%target] = 1;
      schedule(0, 0, wzClansExecuteNext, %target);
   }
}

// --------------------------------------------------------------------------
// Queue processing
// --------------------------------------------------------------------------

function wzClansExecuteNext(%target)
{
   %n = $WZClans::QueueCount[%target] + 0;
   if (%n <= 0)
   {
      $WZClans::Active[%target] = 0;
      return;
   }

   // pop the front of the queue
   %line = $WZClans::Queue[%target, 0];
   for (%i = 1; %i < %n; %i++)
      $WZClans::Queue[%target, %i - 1] = $WZClans::Queue[%target, %i];
   $WZClans::Queue[%target, %n - 1] = "";
   $WZClans::QueueCount[%target] = %n - 1;

   // split path from payload (keep everything after the first tab so a
   // payload could even contain tabs of its own)
   %tab = strStr(%line, "\t");
   %path = getSubStr(%line, 0, %tab);
   %payload = getSubStr(%line, %tab + 1, strlen(%line));

   $WZClans::LastError[%target] = "";

   // a fresh HTTPObject per request; repeated new HTTPObject(WZClansHttp)
   // forms a name group that shares the WZClansHttp:: callback namespace
   %http = new HTTPObject(WZClansHttp);
   %http.target = %target;
   %http.error = "";
   %http.done = 0;
   %http.finishing = 0;
   %http.setHeader("Accept", "text/plain");
   %http.setHeader("User-Agent", "Tribes 2");
   // without this libcurl keeps the connection alive and onDisconnect may
   // never fire (rule 2 above)
   %http.setHeader("Connection", "close");

   if (%payload $= "")
   {
      %http.get($WZClans::Community::Host, %path);
   }
   else
   {
      // The shared layer builds POST payloads the way the original raw-TCP
      // client did: literal "Content-Type: ...\r\nContent-Length: N\r\n\r\n"
      // prepended to the (multipart) body. libcurl sends its own headers, so
      // lift the Content-Type out into a real header and send only the body
      // (curl recomputes Content-Length itself).
      %hdrEnd = strStr(%payload, "\r\n\r\n");
      if (%hdrEnd >= 0)
      {
         %hdrs = getSubStr(%payload, 0, %hdrEnd);
         %payload = getSubStr(%payload, %hdrEnd + 4, strlen(%payload));
         %ctPos = strStr(%hdrs, "Content-Type: ");
         if (%ctPos >= 0)
         {
            %ct = getSubStr(%hdrs, %ctPos + 14, strlen(%hdrs));
            %ct = getSubStr(%ct, 0, strStr(%ct, "\r\n"));
            %http.setHeader("Content-Type", %ct);
         }
      }
      %http.post($WZClans::Community::Host, %path, "", %payload);
   }

   // fail-safe in case the request hangs (matches the 15s failsafe used by
   // the WhoisVpn HTTPObject client)
   %http.failSafe = %http.schedule(15000, "wzClansTimeout");
}

// --------------------------------------------------------------------------
// HTTPObject callbacks (WZClansHttp name group)
// --------------------------------------------------------------------------

// the QoL patch delivers body lines only - forward each one to the shared layer
function WZClansHttp::onLine(%this, %line)
{
   if (%this.done || %this.finishing)
      return;
   if (trim(%line) $= "")
      return;

   wzClansOnLine(%this.target, %line);
}

// server closed the connection: the response is complete
function WZClansHttp::onDisconnect(%this)
{
   if (%this.done || %this.finishing)
      return;
   %this.done = 1;
   %this.schedule(100, "wzClansFinish");
}

function WZClansHttp::onDNSFailed(%this)
{
   wzClansHttpFail(%this, "DNS lookup failed for " @ $WZClans::Community::Host);
}

function WZClansHttp::onConnectFailed(%this)
{
   wzClansHttpFail(%this, "connection to " @ $WZClans::Community::Host @ " failed");
}

function WZClansHttp::wzClansTimeout(%this)
{
   if (!%this.done)
      wzClansHttpFail(%this, "request timed out after 15s");
}

function wzClansHttpFail(%this, %why)
{
   if (%this.done || %this.finishing)
      return;
   %this.error = %why;
   %this.done = 1;
   warn("WZClans: HTTP request (" @ %this.target @ ") failed: " @ %why);
   %this.disconnect();
   %this.schedule(100, "wzClansFinish");
}

// runs 100ms after completion/failure, outside the network callback: free the
// object FIRST, then notify the shared layer - so anything the notify chain
// starts (e.g. the cert request fired by the session UUID handler) is created
// with a clean slate (rule 1 above)
function WZClansHttp::wzClansFinish(%this)
{
   if (%this.finishing)
      return;
   %this.finishing = 1;

   %target = %this.target;
   %error = %this.error;
   if (isEventPending(%this.failSafe))
      cancel(%this.failSafe);

   if (isObject(%this))
      %this.delete();

   // from here on only the locals are used - %this is gone
   if (%error !$= "")
      $WZClans::LastError[%target] = %error;

   // completion hook - may queue further requests for this target
   wzClansOnDisconnect(%target);

   // pump again (also zero-delay scheduled, never from a network callback)
   schedule(0, 0, wzClansExecuteNext, %target);
}
