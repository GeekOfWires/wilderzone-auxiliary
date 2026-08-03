//WhoisVpn.cs
//Super-admin "/whois" chat command with IP geolocation and VPN flagging,
//plus optional auto-kick of VPN users on connect.
//
//All detection happens in the Cloudflare Worker at
//wilderzone-aux.geekofwires.workers.dev (see the wilderzone-auxiliary
//repo): one HTTPS GET per IP returns geolocation, ip-api proxy/hosting
//flags, and the VPN-provider CIDR verdict as a single tab-separated line.
//Nothing is stored in server memory except a small per-IP result cache.
//
//Datacenter detection does not exist here: datacenter CIDR lists and
//ip-api's hosting flag both false-positive on ordinary residential ISPs.
//The hosting flag is still shown in /whois output for information, but it
//never flags.
//
//Install: drop this file in GameData/Classic/scripts/autoexec/ and delete any
//stale .dso files in that folder before launching the server.
//
//Requires the TribesNEXT QoL patch (its libcurl-backed HTTPObject speaks
//HTTPS; the vanilla HTTPObject cannot reach the worker).
//
//Settings: add these lines to GameData/Classic/prefs/serverPrefs.cs
//(the server exports $Host::* back to that file, so they persist):
//
// Master switch for the /whois command and the auto-checks
// $Host::WhoisVpnEnable = 1;
// Worker host and API key. The default key is the public key (rate-limited
// per server IP by the service); override with your own server-role key from
// the admin panel's API Keys page.
// $Host::WhoisVpnWorkerHost = "wilderzone-aux.geekofwires.workers.dev";
// $Host::WhoisApiKey = "wza_ad1c56e73c4e06d4bc0d05b710a88b5e";
// Kick players on connect when their IP is flagged (1 = on)
// $Host::AutoKickVPNs = 0;
// Message shown to the server when someone is auto-kicked. %1 is the player
// name. The default is deliberately generic so the rest of the server is
// not told a VPN kick happened - the kicked player still sees the real
// reason on their disconnect screen.
// $Host::AutoKickAnnounce = "\c2%1 has left the game.";
//
//Usage (super admins only):
// /whois <partial name>  - geolocation, ISP/ASN, proxy/hosting flags,
//                          VPN provider verdict, and what they are playing
//                          from.
// /whoisreload           - clear the per-IP result cache (fresh verdicts
//                          from the worker on next lookup).
// Right-click a player in the scoreboard and choose "Client Info" - super
// admins get the full whois report appended to the stock client info.
//
//Reports include smurf detection using TacoClassic's own process: players
//whose chosen name differs from their real account name (isSmurf, set at
//connect) are flagged with their real account name in the chat output.
//
//Notes:
// - Super admins are exempt from auto-kick.
// - Private/LAN IPs are never checked or acted on.
// - Lookups are asynchronous; an auto action lands a moment after connect.

package WhoisVpn
{
   function chatMessageAll(%sender, %msgString, %a1, %a2, %a3, %a4, %a5, %a6, %a7, %a8, %a9, %a10)
   {
      %text = detag(%a2);
      if(%text $= "/whois" || getSubStr(%text, 0, 7) $= "/whois " || %text $= "/whoisreload")
      {
         whoisChatCmd(%sender, %text);
         return;
      }
      parent::chatMessageAll(%sender, %msgString, %a1, %a2, %a3, %a4, %a5, %a6, %a7, %a8, %a9, %a10);
   }

   // TacoClassic's dtChatCmd package swallows "/" commands without calling
   // parent when its chatMessageAll lands on top of this one - but every
   // variant funnels commands through the global chatCmd(), and a packaged
   // definition of a global function wins over the root one regardless of
   // package order. Hook it here as well so /whois always lands.
   function chatCmd(%client, %message)
   {
      %command = strLwr(trim(getWord(detag(%message), 0)));
      if(%command $= "/whois" || %command $= "/whoisreload")
      {
         whoisChatCmd(%client, detag(%message));
         return;
      }
      parent::chatCmd(%client, %message);
   }

   function GameConnection::onConnect(%client, %name, %raceGender, %skin, %voice, %voicePitch)
   {
      parent::onConnect(%client, %name, %raceGender, %skin, %voice, %voicePitch);
      whoisAutoCheck(%client);
   }

   // The right-click popup only reliably invokes built-in server commands,
   // so instead of a custom menu item we extend TacoClassic's own Client
   // Info action: super admins get the full whois report appended to the
   // stock client info output.
   function ServerCmdPrintClientInfo(%client, %targetClient)
   {
      parent::ServerCmdPrintClientInfo(%client, %targetClient);

      if(%client.isSuperAdmin && whoisEnabled() && isObject(%targetClient) && !%targetClient.isAIControlled())
         whoisDoLookup(%client, %targetClient);
   }
};

// Prevent package from being activated if it is already
if(!isActivePackage(WhoisVpn))
   activatePackage(WhoisVpn);

/////////////////////////////////////////////////////////////////////////////
// Prefs
/////////////////////////////////////////////////////////////////////////////

function whoisEnabled()
{
   if($Host::WhoisVpnEnable $= "")
      $Host::WhoisVpnEnable = 1;
   return $Host::WhoisVpnEnable;
}

function whoisWorkerHost()
{
   if($Host::WhoisVpnWorkerHost $= "")
      $Host::WhoisVpnWorkerHost = "wilderzone-aux.geekofwires.workers.dev";
   return $Host::WhoisVpnWorkerHost;
}

function whoisWorkerKey()
{
   if($Host::WhoisApiKey $= "")
      $Host::WhoisApiKey = "wza_ad1c56e73c4e06d4bc0d05b710a88b5e";
   return $Host::WhoisApiKey;
}

function whoisKickAnnounce()
{
   if($Host::AutoKickAnnounce $= "")
      $Host::AutoKickAnnounce = "\c2%1 has left the game.";
   return $Host::AutoKickAnnounce;
}

/////////////////////////////////////////////////////////////////////////////
// IP helpers
/////////////////////////////////////////////////////////////////////////////

// Dotted-quad IP without the "IP:" prefix or ":port" suffix
function whoisGetIp(%client)
{
   %addr = %client.getAddress();
   if(getSubStr(%addr, 0, 3) !$= "IP:")
      return "";
   %addr = getSubStr(%addr, 3, strLen(%addr));
   return getSubStr(%addr, 0, strStr(%addr, ":"));
}

function whoisIsPrivate(%ip)
{
   %o = strReplace(%ip, ".", "\t");
   %a = getField(%o, 0);
   %b = getField(%o, 1);
   return (%a == 0 || %a == 10 || %a == 127 ||
           (%a == 172 && %b >= 16 && %b <= 31) ||
           (%a == 192 && %b == 168) ||
           (%a == 169 && %b == 254));
}

/////////////////////////////////////////////////////////////////////////////
// Worker lookup (QoL patch HTTPObject, HTTPS)
/////////////////////////////////////////////////////////////////////////////

function whoisCacheKey(%ip)
{
   return strReplace(%ip, ".", "_");
}

function whoisCacheHas(%ip)
{
   return $WhoisVpn::CStatus[whoisCacheKey(%ip)] $= "success";
}

// Look up %ip against the worker.
// %subject is the client being auto-checked (0 for /whois - no auto action),
// %requestor is the admin to reply to (0 for auto-check).
function whoisIpApi(%ip, %subject, %requestor)
{
   %name = "";
   %guid = "";
   if(isObject(%subject))
   {
      %name = %subject.nameBase;
      %guid = %subject.guid;
   }
   else if(isObject(%requestor) && isObject(%requestor.whoisTarget))
   {
      %name = %requestor.whoisTarget.nameBase;
      %guid = %requestor.whoisTarget.guid;
   }

   %http = new HTTPObject(WhoisVpnHttp);
   %http.ip = %ip;
   %http.subject = %subject;
   %http.requestor = %requestor;
   %http.done = 0;
   %http.setHeader("Accept", "text/plain");
   if(whoisWorkerKey() !$= "")
      %http.setHeader("X-Tribes-Key", whoisWorkerKey());
   %http.get(whoisWorkerHost(), "/tribes-api/check?ip=" @ %ip @ "&name=" @ %name @ "&guid=" @ %guid);
   // fail-safe cleanup if the request hangs
   %http.failSafe = %http.schedule(15000, "whoisTimeout");
}

function WhoisVpnHttp::onLine(%this, %line)
{
   if(%this.done)
      return;

   // response body is a single tab-separated line starting with OK or ERR
   if(getSubStr(%line, 0, 2) $= "OK" || getSubStr(%line, 0, 3) $= "ERR")
   {
      %this.done = 1;
      %this.resultLine = %line;
      // never delete the object or do heavy work inside its own network
      // callback (crashed the server before) - deliver on a schedule instead
      %this.schedule(100, "whoisDeliver");
   }
}

function WhoisVpnHttp::whoisDeliver(%this)
{
   whoisHandleResult(%this, %this.resultLine);
   if(isObject(%this))
      %this.delete();
}

function WhoisVpnHttp::onDNSFailed(%this)
{
   whoisHttpFail(%this, "DNS lookup failed");
}

function WhoisVpnHttp::onConnectFailed(%this)
{
   whoisHttpFail(%this, "connection failed");
}

function WhoisVpnHttp::whoisTimeout(%this)
{
   if(!%this.done)
      whoisHttpFail(%this, "request timed out");
}

function whoisHttpFail(%this, %why)
{
   echo("WhoisVpn: worker lookup for " @ %this.ip @ " failed: " @ %why);
   if(isObject(%this.requestor))
      messageClient(%this.requestor, "msgChatCmd", "\c2Whois: worker lookup failed (" @ %why @ ").");
   if(isObject(%this))
      %this.delete();
}

// TSV field layout from the worker:
// 0 status, 1 flagged, 2 proxy, 3 hosting, 4 matchedCIDR (or -),
// 5 country, 6 region, 7 city, 8 isp, 9 org, 10 as
function whoisHandleResult(%this, %line)
{
   if(getField(%line, 0) !$= "OK")
   {
      %err = getField(%line, 1);
      if(isObject(%this.requestor))
         messageClient(%this.requestor, "msgChatCmd", "\c2Whois: worker returned an error (" @ %err @ ") for " @ %this.ip @ ".");
      echo("WhoisVpn: worker error for " @ %this.ip @ ": " @ %err);
      return;
   }

   // cache per IP
   %key = whoisCacheKey(%this.ip);
   $WhoisVpn::CStatus[%key]  = "success";
   $WhoisVpn::CFlagged[%key] = getField(%line, 1);
   $WhoisVpn::CProxy[%key]   = getField(%line, 2);
   $WhoisVpn::CHosting[%key] = getField(%line, 3);
   $WhoisVpn::CMatched[%key] = getField(%line, 4);
   $WhoisVpn::CCountry[%key] = getField(%line, 5);
   $WhoisVpn::CRegion[%key]  = getField(%line, 6);
   $WhoisVpn::CCity[%key]    = getField(%line, 7);
   $WhoisVpn::CIsp[%key]     = getField(%line, 8);
   $WhoisVpn::COrg[%key]     = getField(%line, 9);
   $WhoisVpn::CAs[%key]      = getField(%line, 10);

   if(isObject(%this.requestor))
      whoisReport(%this.requestor, %this.ip);
   else if(isObject(%this.subject))
      whoisAutoVerdict(%this.subject, %this.ip);
}

/////////////////////////////////////////////////////////////////////////////
// Verdicts and actions
/////////////////////////////////////////////////////////////////////////////

// Returns "" if clean, otherwise a short reason string for display/actions.
function whoisFlagReason(%ip)
{
   %key = whoisCacheKey(%ip);
   if(!whoisCacheHas(%ip) || $WhoisVpn::CFlagged[%key] != 1)
      return "";

   if($WhoisVpn::CMatched[%key] !$= "-" && $WhoisVpn::CMatched[%key] !$= "")
      return "VPN (provider list, " @ $WhoisVpn::CMatched[%key] @ ")";

   return "VPN/Proxy (ip-api proxy flag)";
}

function whoisAutoCheck(%client)
{
   if(!isObject(%client))
      return;
   if(!whoisEnabled() || !$Host::AutoKickVPNs)
      return;
   if(%client.isAIControlled() || %client.isSuperAdmin)
      return;

   %ip = whoisGetIp(%client);
   if(%ip $= "" || whoisIsPrivate(%ip))
      return;

   if(whoisCacheHas(%ip))
   {
      whoisAutoVerdict(%client, %ip);
      return;
   }

   whoisIpApi(%ip, %client, 0);
}

function whoisAutoVerdict(%client, %ip)
{
   %reason = whoisFlagReason(%ip);
   if(%reason !$= "")
      whoisTakeAction(%client, %reason);
}

function whoisTakeAction(%client, %reason)
{
   if(!isObject(%client))
      return;

   if($Host::AutoKickVPNs)
   {
      // generic announcement by default - the server is not told why they
      // left, but the player sees the real reason on their disconnect screen
      messageAll('MsgAdminForce', whoisKickAnnounce(), %client.nameBase);
      messageClient(%client, 'onClientKicked', "");
      if(isObject(%client.player))
         %client.player.scriptKill(0);
      %client.setDisconnectReason("VPN connections are not allowed on this server.");
      %client.schedule(700, "delete");
      echo("WhoisVpn: auto-kicked " @ %client.nameBase @ ": " @ %reason);
   }
}

/////////////////////////////////////////////////////////////////////////////
// /whois chat command (super admins only)
/////////////////////////////////////////////////////////////////////////////

function whoisFindClient(%partial)
{
   %partial = strLwr(%partial);
   for(%i = 0; %i < ClientGroup.getCount(); %i++)
   {
      %cl = ClientGroup.getObject(%i);
      if(strStr(strLwr(%cl.nameBase), %partial) >= 0)
         return %cl;
   }
   return 0;
}

function whoisChatCmd(%sender, %text)
{
   if(!%sender.isSuperAdmin)
      return;

   if(%text $= "/whoisreload")
   {
      deleteVariables("$WhoisVpn::C*");
      messageClient(%sender, "msgChatCmd", "\c2Whois: result cache cleared - next lookups are fresh from the worker.");
      return;
   }

   %target = trim(getWords(%text, 1, 99));
   if(%target $= "")
   {
      messageClient(%sender, "msgChatCmd", "\c2Usage: /whois <partial name>  |  /whoisreload");
      return;
   }

   %cl = whoisFindClient(%target);
   if(!isObject(%cl))
   {
      messageClient(%sender, "msgChatCmd", "\c2Whois: no player matching \"" @ %target @ "\".");
      return;
   }

   whoisDoLookup(%sender, %cl);
}

// Smurf detail, the same way TacoClassic's original process determines it:
// the connect code sets %client.isSmurf when the chosen name differs from
// the real account name in the auth info. The real name is field 0 of
// getAuthInfo() - the same source ServerCmdPrintClientInfo uses.
function whoisSmurfLine(%cl)
{
   %realName = getField(%cl.getAuthInfo(), 0);
   if(%realName $= "" && %cl.t2csri_authInfo !$= "")
      %realName = getField(%cl.t2csri_authInfo, 0);

   if(%cl.isSmurf)
   {
      if(%realName !$= "")
         return "\c2Smurf: \c6yes\c2 - real account is \c3" @ realNameFix(%realName);
      return "\c2Smurf: \c6yes";
   }
   return "\c2Smurf: \c3no";
}

// strip color/format codes out of an account name for display
function realNameFix(%name)
{
   return stripChars(%name, "\cp\co\c0\c1\c2\c3\c4\c5\c6\c7\c8\c9") @ "\c2";
}

// Shared lookup flow for the chat command and the player popup menu.
function whoisDoLookup(%sender, %cl)
{
   %ip = whoisGetIp(%cl);
   if(%ip $= "")
   {
      if(%cl.getAddress() $= "Local")
         messageClient(%sender, "msgChatCmd", "\c2Whois: " @ %cl.nameBase @ " is the listen-server host (Local) - no public IP to look up.");
      else
         messageClient(%sender, "msgChatCmd", "\c2Whois: no IP for " @ %cl.nameBase @ " (bot or local client).");
      return;
   }

   messageClient(%sender, "msgChatCmd", "\c2Whois: \c3" @ %cl.nameBase @ "\c2  IP: " @ %ip @ "  GUID: " @ %cl.guid);
   messageClient(%sender, "msgChatCmd", whoisSmurfLine(%cl));

   if(whoisIsPrivate(%ip))
   {
      messageClient(%sender, "msgChatCmd", "\c2Private/LAN address - not checked.");
      return;
   }

   // geolocation: cached or live lookup
   if(whoisCacheHas(%ip))
      whoisReport(%sender, %ip);
   else
   {
      messageClient(%sender, "msgChatCmd", "\c2Looking up " @ whoisWorkerHost() @ "...");
      // remember the target so the query log gets their name/guid
      %sender.whoisTarget = %cl;
      whoisIpApi(%ip, 0, %sender);
   }
}

// Player right-click popup: choosing "Client Info" as a super admin also
// runs the whois lookup (see the package override at the top of this file).
// The stock popup only reliably invokes built-in server commands, so the
// lookup rides on TacoClassic's own PrintClientInfo path.

function whoisReport(%admin, %ip)
{
   if(!isObject(%admin))
      return;

   %key = whoisCacheKey(%ip);
   %city    = $WhoisVpn::CCity[%key];
   %region  = $WhoisVpn::CRegion[%key];
   %country = $WhoisVpn::CCountry[%key];
   %isp     = $WhoisVpn::CIsp[%key];
   %org     = $WhoisVpn::COrg[%key];
   %as      = $WhoisVpn::CAs[%key];
   %proxy   = $WhoisVpn::CProxy[%key];
   %hosting = $WhoisVpn::CHosting[%key];
   %matched = $WhoisVpn::CMatched[%key];

   %loc = %city;
   if(%region !$= "" && %region !$= %city)
      %loc = %loc @ ", " @ %region;
   if(%country !$= "")
      %loc = %loc @ ", " @ %country;
   if(%loc $= "")
      %loc = "unknown";

   messageClient(%admin, "msgChatCmd", "\c2Location: \c3" @ %loc);
   messageClient(%admin, "msgChatCmd", "\c2Network: \c3" @ %isp @ ((%org !$= "" && %org !$= %isp) ? " / " @ %org : "") @ "\c2  " @ %as);
   messageClient(%admin, "msgChatCmd", "\c2ip-api flags: proxy=" @ (%proxy ? "\c6yes" : "\c3no") @ "\c2 hosting=" @ (%hosting ? "\c6yes" : "\c3no"));

   if(%matched !$= "" && %matched !$= "-")
      messageClient(%admin, "msgChatCmd", "\c2List match: \c6" @ %matched);

   // verdict: what are they playing from (hosting flag is shown for info
   // above but never flags - it false-positives on residential ISPs)
   %reason = whoisFlagReason(%ip);
   if(%reason !$= "")
      messageClient(%admin, "msgChatCmd", "\c2Verdict: \c6FLAGGED\c2 - playing through a " @ %reason @ ".");
   else
      messageClient(%admin, "msgChatCmd", "\c2Verdict: \c3clean\c2 - no VPN indicators; looks like a residential/mobile connection in " @ %loc @ ".");
}

/////////////////////////////////////////////////////////////////////////////
// Startup
/////////////////////////////////////////////////////////////////////////////

echo("WhoisVpn: using worker at " @ whoisWorkerHost());
