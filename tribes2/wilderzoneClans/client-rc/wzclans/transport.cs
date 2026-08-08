// TribesNext Project
// http://www.tribesnext.com/
// Copyright 2011

// Tribes 2 Community System
// Robot Client Transport (RC flavor)

// Wilderzone adaptation notes:
//  - This is the RC (ruby-capable TribesNEXT) flavor of the community client transport.
//    The TCPObject/HTTP code below is lifted from the original TribesNext t2-scripts
//    login.cs / browser.cs / mail.cs (TribesNext Project, 2011-2013), where it was
//    inline in each client. It is centralized here so the shared code in
//    client-common/wzclans/ never touches TCPObject or rubyEval.
//  - FLAVOR DUTIES (hook contract with the shared code):
//      wzClansHttpRequest(%target, %path, %payload)  -- called by shared code to send
//        one HTTP/1.1 request to $WZClans::Community::Host : $WZClans::Community::Port
//        with "Connection: close". %target is "session", "browser", or "mail";
//        %path is the URL path+query; %payload is "" for GET, otherwise a POST body
//        (with its multipart Content-Type/Content-Length headers, as built by the
//        shared code, exactly like the originals).
//      For each response BODY line the transport calls wzClansOnLine(%target, %line),
//        after parsing off the HTTP headers with the original "primed" blank-line
//        logic; when the response completes it calls wzClansOnDisconnect(%target).
//      wzClansDecryptChallenge(%hexChallenge) -- RSA challenge decrypt via rubyEval,
//        exactly the original $accountKey.decrypt pattern. The shared session code
//        validates that %hexChallenge is pure hex BEFORE this hook is invoked, so the
//        ruby interpreter can never receive a hostile payload.
//      wzClansEpoch() -- current unix epoch via rubyEval Time.now().to_i, like the
//        original browser.cs cert-refresh scheduling.
//      wzClansGetLoginCertificate() -- returns $LoginCertificate, which the RC2a
//        patch must already have set (fields: 0=name, 1=guid, 2=e, 3=n, 4=sig).
//  - Requests are serialized per target by the shared code's request queues
//    (browser.cs / mail.cs) and by the session scheduler (session.cs); this transport
//    keeps one persistent TCPObject per target, like the originals.

// =========================================================================
// flavor hook: send one HTTP request.
//
// Plaintext HTTP on port 80, exactly the original 2011 code path. RC2a has no
// HTTPS route: TCPObject is plaintext-only, and the patch's embedded Ruby 1.9.0
// (msvcrt-ruby190.dll + rubyintersect.dll) contains no socket or OpenSSL
// support - verified by binary inspection - so no Ruby HTTPS transport is
// possible. If the community server ever stops serving port 80, this flavor
// needs a local TLS-terminating proxy (e.g. stunnel on localhost:80) and a
// matching $WZClans::Community::Host change in wzclans/local.cs.

function wzClansHttpRequest(%target, %path, %payload)
{
	if (%payload $= "")
	{
		%data = "GET " @ %path;
		%data = %data @ " HTTP/1.1\r\nHost: " @ $WZClans::Community::Host @ "\r\nUser-Agent: Tribes 2\r\nConnection: close\r\n\r\n";
	}
	else
	{
		%data = "POST " @ %path @ " HTTP/1.1\r\n";
		%data = %data @ "Host: " @ $WZClans::Community::Host @ "\r\nUser-Agent: Tribes 2\r\nConnection: close\r\n";
		%data = %data @ %payload;
	}

	// one persistent TCPObject per target, as in the original clients
	if (%target $= "session")
	{
		if (isObject(WZClansSessionInterface))
		{
			WZClansSessionInterface.disconnect();
		}
		else
		{
			new TCPObject(WZClansSessionInterface);
		}
		WZClansSessionInterface.data = %data;
		WZClansSessionInterface.connect($WZClans::Community::Host @ ":" @ $WZClans::Community::Port);
	}
	else if (%target $= "browser")
	{
		if (isObject(WZClansBrowserInterface))
		{
			WZClansBrowserInterface.disconnect();
		}
		else
		{
			new TCPObject(WZClansBrowserInterface);
		}
		WZClansBrowserInterface.data = %data;
		WZClansBrowserInterface.connect($WZClans::Community::Host @ ":" @ $WZClans::Community::Port);
	}
	else if (%target $= "mail")
	{
		if (isObject(WZClansMailInterface))
		{
			WZClansMailInterface.disconnect();
		}
		else
		{
			new TCPObject(WZClansMailInterface);
		}
		WZClansMailInterface.data = %data;
		WZClansMailInterface.connect($WZClans::Community::Host @ ":" @ $WZClans::Community::Port);
	}
	else
	{
		error("WZClans: wzClansHttpRequest called with unknown target " @ %target);
	}
}

// =========================================================================
// per-target TCPObject callbacks: send on connect, strip HTTP headers with the
// original "primed" blank-line logic, forward body lines and disconnects to
// the shared dispatchers

function WZClansSessionInterface::onConnected(%this)
{
	//echo("Sending: " @ %this.data);
	%this.primed = 0;
	%this.send(%this.data);
}

function WZClansSessionInterface::onLine(%this, %line)
{
	if (trim(%line) $= "")
	{
		%this.primed = 1;
		return;
	}
	if (!%this.primed)
		return;
	wzClansOnLine("session", %line);
}

function WZClansSessionInterface::onDisconnect(%this)
{
	wzClansOnDisconnect("session");
}

function WZClansBrowserInterface::onConnected(%this)
{
	//echo("Browser-Sending: " @ %this.data);
	%this.primed = 0;
	%this.send(%this.data);
}

function WZClansBrowserInterface::onLine(%this, %line)
{
	if (trim(%line) $= "")
	{
		%this.primed = 1;
		return;
	}
	if (!%this.primed)
		return;
	wzClansOnLine("browser", %line);
}

function WZClansBrowserInterface::onDisconnect(%this)
{
	wzClansOnDisconnect("browser");
}

function WZClansMailInterface::onConnected(%this)
{
	//echo("Sending: " @ %this.data);
	%this.primed = 0;
	%this.send(%this.data);
}

function WZClansMailInterface::onLine(%this, %line)
{
	if (trim(%line) $= "")
	{
		%this.primed = 1;
		return;
	}
	if (!%this.primed)
		return;
	wzClansOnLine("mail", %line);
}

function WZClansMailInterface::onDisconnect(%this)
{
	wzClansOnDisconnect("mail");
}

// =========================================================================
// flavor hooks: ruby-backed crypto/time and the RC2a login certificate

// RSA private-key decrypt of the session challenge; input is guaranteed pure
// lowercase hex by the shared session code (same safety invariant as the original)
function wzClansDecryptChallenge(%hexChallenge)
{
	$wzClansDecryptedChallenge = "";
	rubyEval("tsEval '$wzClansDecryptedChallenge=\"' + $accountKey.decrypt('" @ %hexChallenge @ "'.to_i(16)).to_s(16) + '\";'");
	return $wzClansDecryptedChallenge;
}

// current unix epoch, as used by the original browser.cs cert-refresh scheduling
function wzClansEpoch()
{
	$wzClansEpochTemp = 0;
	rubyEval("tsEval '$wzClansEpochTemp=\"' + Time.now().to_i.to_s + '\";'");
	return $wzClansEpochTemp;
}

// the RC2a patch sets $LoginCertificate during login (t2csri_getAccount in
// t2csri/clientSide.cs). If it has not been set yet, pull the certificate for
// the currently selected account name straight from the credential store -
// note that the RC2a t2csri_getAccountCertificate takes the account NAME and
// reads the Ruby certstore (it is not the QoL native no-arg function).
function wzClansGetLoginCertificate()
{
	if ($LoginCertificate $= "" && $LoginName !$= "")
		$LoginCertificate = t2csri_getAccountCertificate($LoginName);
	return $LoginCertificate;
}
