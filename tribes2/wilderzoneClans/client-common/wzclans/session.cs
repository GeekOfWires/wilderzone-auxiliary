// TribesNext Project
// http://www.tribesnext.com/
// Copyright 2011

// Tribes 2 Community System
// Robot Session Client

// Since the game itself does not store the users' passwords for any longer than is required
// to decrypt their RSA private keys, the "robot" client must negotiate sessions through an
// RSA challenge/response.

// The robot client issues a challenge request by sending the user's GUID and a random nonce.
// The DCE issues a challenge that is encrypted with the user's public key. The challenge is
// valid for a server configured lifetime, during which any challenge request by the same GUID
// would return the same challenge. The client sends the decrypted challenge back to the DCE, and
// if it is a match, a session is initiated, and a session UUID is returned to the robot client,
// which it uses to verify its identity for all authenticated requests. The challenge lifetime is
// sufficiently generous to allow an RSA decryption and heavy network latency.

// The client will refresh periodically (every 10 minutes by default) to keep the session alive.

// Wilderzone adaptation notes:
//  - Adapted from the TribesNext t2-scripts login.cs (TribesNext Project, 2011).
//  - All community identifiers renamed: $TribesNext::Community:: -> $WZClans::Community::,
//    tn_community_* -> wzClans_* (collision avoidance with older community scripts).
//  - TRANSPORT SPLIT: this shared file no longer creates a TCPObject or builds raw HTTP
//    request text. It builds only the path+query and calls the flavor hook
//    wzClansHttpRequest("session", %path, %payload). Response body lines arrive via the
//    shared dispatcher wzClansOnLine("session", %line) (defined at the bottom of this
//    file), which forwards to wzClans_session_onLine(%line) below.
//  - HOOK CONTRACT: shared code never calls rubyEval and never touches TCPObject/HTTPObject.
//    The flavor must provide:
//       wzClansHttpRequest(%target, %path, %payload)  -- send one HTTP request
//       wzClansDecryptChallenge(%hexChallenge)        -- RSA private-key decrypt, returns hex
//       wzClansEpoch()                                -- current unix epoch (used by browser.cs)
//       wzClansGetLoginCertificate()                  -- returns the login certificate
//    The hostile-payload hex validation and the nonce-prefix verification remain here in
//    shared code (validation happens BEFORE the decrypt hook is invoked, exactly as in the
//    original, so the flavor hook never receives an unsanitized challenge).
//  - The original exec()'d mail.cs/browser.cs/mailUI.cs/browserUI.cs after acquiring a UUID.
//    That was removed: the flavor entry point execs all shared files up front. The
//    wzClans_Browser_request_cert() call on UUID acquisition is kept.
//  - $LoginCertificate field layout (returned by wzClansGetLoginCertificate()):
//    0=name, 1=guid, 2=e, 3=n (modulus), 4=sig.

function wzClans_session_onLine(%line)
{
	// (all response lines are echoed by the wzClansOnLine dispatcher when
	// $WZClans::Community::Verbose is on - which is the default)
	if (getSubStr(%line, 0, 11) $= "CHALLENGE: ")
	{
		$WZClans::Community::SessionErrors = 0;
		$WZClans::Community::Challenge = getSubStr(%line, 11, strlen(%line));
		//error("Challenge set: " @ $WZClans::Community::Challenge);

		cancel($WZClans::Community::SessionSchedule);
		$WZClans::Community::SessionSchedule = schedule(200, 0, wzClans_login_initiate);
	}
	else if (getSubStr(%line, 0, 6) $= "UUID: ")
	{
		$WZClans::Community::SessionErrors = 0;
		$WZClans::Community::UUID = getSubStr(%line, 6, strlen(%line));
		$WZClans::Community::Challenge = "";
		//error("UUID set: " @ $WZClans::Community::UUID);

		cancel($WZClans::Community::SessionSchedule);
		$WZClans::Community::SessionSchedule = schedule($WZClans::Community::SessionRefresh * 1000, 0, wzClans_login_initiate);

		// (Wilderzone: the UI coercion scripts modify stock GUI elements, which
		//  do not exist yet when this mod's autoexec entry runs - the original
		//  deferred these exec()s until the first UUID for exactly that reason,
		//  and so do we. By the time the first session round trip completes, the
		//  stock GUI is loaded.)
		if (!$WZClans::Community::UILoaded)
		{
			$WZClans::Community::UILoaded = 1;
			exec("wzclans/mailUI.cs");
			exec("wzclans/browserUI.cs");
		}
		// if the launch screen was already showing before the session came up,
		// make sure the community tabs are active there too
		wzClans_enableLaunchTabs();
		// Wilderzone: no automatic certificate request. The community server's
		// cert issuer is disabled (its signer's validity period expired), and
		// clan tags are now handled server-side via the Wilderzone Auxiliary
		// tag API - the client only provides the Mail & Browser functions.
	}
	else if (getSubStr(%line, 0, 5) $= "ERR: ")
	{
		error("Session negotiation error: " @ getSubStr(%line, 5, strlen(%line)));
		$WZClans::Community::UUID = "";
		$WZClans::Community::Challenge = "";

		// add schedule with backoff, up to about 15 minutes
		$WZClans::Community::SessionErrors++;
		if ($WZClans::Community::SessionErrors > 66)
			$WZClans::Community::SessionErrors = 66;
		$WZClans::Community::SessionSchedule = schedule(200 * ($WZClans::Community::SessionErrors * $WZClans::Community::SessionErrors), 0, wzClans_login_initiate);
	}
	else if (getSubStr(%line, 0, 9) $= "REFRESHED")
	{
		$WZClans::Community::SessionErrors = 0;
		//error("Session refreshed. Scheduling next ping.");

		cancel($WZClans::Community::SessionSchedule);
		$WZClans::Community::SessionSchedule = schedule($WZClans::Community::SessionRefresh * 1000, 0, wzClans_login_initiate);
	}
	else if (getSubStr(%line, 0, 7) $= "TIMEOUT")
	{
		$WZClans::Community::SessionErrors = 0;
		//error("Session timed out. Refreshing.");
		$WZClans::Community::UUID = "";
		$WZClans::Community::Challenge = "";

		cancel($WZClans::Community::SessionSchedule);
		$WZClans::Community::SessionSchedule = schedule(200, 0, wzClans_login_initiate);
	}
}

// initiates the session negotiation process
function wzClans_login_initiate()
{
	if (isEventPending($WZClans::Community::SessionSchedule))
	{
		cancel($WZClans::Community::SessionSchedule);
	}

	// no account logged in yet (the entry point runs before the login screen):
	// poll quietly instead of hammering the API with an empty guid
	%cert = wzClansGetLoginCertificate();
	if (getField(%cert, 1) $= "")
	{
		$WZClans::Community::SessionSchedule = schedule(2000, 0, wzClans_login_initiate);
		return;
	}

	%path = $WZClans::Community::BaseURL @ $WZClans::Community::LoginScript @ "?guid=" @ getField(%cert, 1) @ "&";
	// is there an existing session?
	if ($WZClans::Community::UUID !$= "")
	{
		// try to refresh it
		%path = %path @ "uuid=" @ $WZClans::Community::UUID;
	}
	else
	{
		// no session -- either expired, or never had one

		// is a challenge present
		if ($WZClans::Community::Challenge $= "")
		{
			// no challenge present... ask for one:
			// create a random nonce half of the length of the active RSA key modulus
			%length = strlen(getField(wzClansGetLoginCertificate(), 3)) / 2;
			%nonce = "1"; // start with a one to prevent truncation issues
			for (%i = 1; %i < %length; %i++)
			{
				%nibble = getRandom(0, 15);
				if (%nibble == 10)
					%nibble = "a";
				else if (%nibble == 11)
					%nibble = "b";
				else if (%nibble == 12)
					%nibble = "c";
				else if (%nibble == 13)
					%nibble = "d";
				else if (%nibble == 14)
					%nibble = "e";
				else if (%nibble >= 15)
					%nibble = "f";
				%nonce = %nonce @ %nibble;
			}
			$WZClans::Community::Nonce = %nonce;
			// transmit the request to the community server
			%path = %path @ "nonce=" @ %nonce;
		}
		else
		{
			%challenge = strlwr($WZClans::Community::Challenge);
			for (%i = 0; %i < strlen(%challenge); %i++)
			{
				%char = strcmp(getSubStr(%challenge, %i, 1), "");
				if ((%char < 48 || %char > 102) || (%char > 57 && %char < 97))
				{
					// non-hex characters in the challenge!
					error("WZClans: Hostile challenge payload returned by server!");
					$WZClans::Community::Challenge = "";
					wzClans_login_initiate();
					return;
				}
			}

			// challenge is present (and validated as pure hex above)... decrypt it via
			// the flavor hook and transmit the response to the community server
			%decryptedChallenge = wzClansDecryptChallenge(%challenge);

			%verifiedNonce = getSubStr(%decryptedChallenge, 0, strLen($WZClans::Community::Nonce));
			if (%verifiedNonce !$= $WZClans::Community::Nonce)
			{
				// this is not the nonce we sent to the community server, try again
				error("WZClans: Unmatched nonce in challenge returned by server!");
				$WZClans::Community::Challenge = "";
				wzClans_login_initiate();
				return;
			}
			else
			{
				%response = getSubStr(%decryptedChallenge, strLen($WZClans::Community::Nonce), strlen(%decryptedChallenge));
				%path = %path @ "response=" @ %response;
			}
		}
	}

	wzClansHttpRequest("session", %path, "");
}

// =========================================================================
// Shared response dispatchers (hook contract).
//
// The flavor transport parses off the HTTP response headers (the original
// "primed" blank-line logic) and calls wzClansOnLine(%target, %line) once per
// response BODY line, then wzClansOnDisconnect(%target) when the response
// completes. %target is "session", "browser", or "mail".
//
// Wilderzone: verbose logging is ON by default - every response line from the
// community server is echoed to the console, prefixed with its target. Silence
// it from wzclans/local.cs with:  $WZClans::Community::Verbose = 0;

if ($WZClans::Community::Verbose $= "")
	$WZClans::Community::Verbose = 1;

function wzClansOnLine(%target, %line)
{
	if ($WZClans::Community::Verbose)
		echo("WZClans[" @ %target @ "] " @ %line);

	if (%target $= "session")
		wzClans_session_onLine(%line);
	else if (%target $= "browser")
		wzClans_browser_onLine(%line);
	else if (%target $= "mail")
		wzClans_mail_onLine(%line);
	else
		error("WZClans: wzClansOnLine called with unknown target " @ %target);
}

function wzClansOnDisconnect(%target)
{
	if (%target $= "session")
	{
		// the original session client had no onDisconnect handler
	}
	else if (%target $= "browser")
		wzClans_browser_onDisconnect();
	else if (%target $= "mail")
		wzClans_mail_onDisconnect();
	else
		error("WZClans: wzClansOnDisconnect called with unknown target " @ %target);
}
