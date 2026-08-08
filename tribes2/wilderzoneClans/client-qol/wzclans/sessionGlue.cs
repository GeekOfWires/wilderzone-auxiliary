// Wilderzone Clan Client - QOL flavor
// Session crypto / time / certificate glue
//
// Replaces the Ruby bridge of the original TribesNext robot client
// (login.cs called rubyEval with $accountKey.decrypt(...) and Time.now).
// The QoL patch exports the same capabilities as native TorqueScript
// functions, so the glue is a thin pass-through.
//
// Adapted from the TribesNext Project robot client sources
// (Copyright 2011 TribesNext Project, http://www.tribesnext.com/) and from
// Thyth's t2csri clientSide.cs (Copyright 2008 Electricutioner/Thyth and the
// Tribes 2 Community System Reengineering Initiative).
// QOL flavor by the Wilderzone project.

// RSA-decrypt the hex challenge issued by robot_login.php using the active
// account's private key. t2csri_rsa_decrypt is the same native function the
// t2csri client uses for game-server challenge/response
// (t2csri/clientSide.cs: %decryptedChallenge = t2csri_rsa_decrypt(%challenge)).
// The shared session layer sanitizes the challenge to lowercase hex and
// verifies the nonce prefix itself, exactly like the original client.
function wzClansDecryptChallenge(%hexChallenge)
{
   return t2csri_rsa_decrypt(%hexChallenge);
}

// Current unix epoch (seconds). The original client got this from Ruby's
// Time.now; the QoL patch's IFC22.dll exports currentEpochTime().
// NOTE: currentEpochTime() is confirmed in use by the t2csri SERVER side
// (t2csri/serverSideClans.cs in clientfiles/base/t2csri.vl2). Its client-side
// availability is assumed - both sides link the same IFC22 exports - but was
// not directly verifiable from the reference scripts.
function wzClansEpoch()
{
   return currentEpochTime();
}

// The active account's login certificate (tab-separated fields:
// 0=name, 1=guid, 2=e, 3=n hex modulus, 4=sig). Mirrors the QOL/t2csri
// convention from clientSide.cs WONGetAuthInfo(): fetch the certificate
// natively and cache it in $LoginCertificate for the rest of the system.
function wzClansGetLoginCertificate()
{
   $LoginCertificate = t2csri_getAccountCertificate();
   return $LoginCertificate;
}
