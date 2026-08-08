// Wilderzone Clan Client - QOL flavor
// ====================================
//
// In-game TribesNEXT community system client (clans + T-Mail) for Tribes 2
// clients running the TribesNEXT QoL patch. The QoL patch provides the two
// things the original 2011 robot client got from its bundled Ruby interpreter:
//   - native RSA session crypto (t2csri_rsa_decrypt, also used by t2csri)
//   - a libcurl-backed HTTPObject that speaks HTTPS
// so no Ruby and no external process is required.
//
// This file is the flavor entry point. It loads:
//   wzclans/settings.cs    - community server settings ($WZClans::Community::*)
//   wzclans/transport.cs   - wzClansHttpRequest: HTTPS transport with per-target
//                            request serialization (session/browser/mail)
//   wzclans/sessionGlue.cs - wzClansDecryptChallenge / wzClansEpoch /
//                            wzClansGetLoginCertificate native glue
// plus the shared, flavor-neutral layers from client-common (session.cs,
// browser.cs, mail.cs, browserUI.cs, mailUI.cs), which are merged into the
// wzclans/ directory of this vl2 at build time.
//
// Adapted from the TribesNext Project robot client sources
// (login.cs / settings.cs / browser.cs / mail.cs / browserUI.cs / mailUI.cs,
// Copyright 2011-2013 TribesNext Project, http://www.tribesnext.com/) and from
// Thyth's t2csri client (Copyright 2008 Electricutioner/Thyth and the
// Tribes 2 Community System Reengineering Initiative).
// QOL flavor and packaging by the Wilderzone project.
//
// Requirements:
//   - TribesNEXT community patch (t2csri) account system
//   - TribesNEXT QoL patch (HTTPS-capable HTTPObject, native crypto exports)
//
// Install:
//   Drop the wilderzoneClanClientQOL vl2 into GameData/base/ and launch the
//   game. Delete any stale scripts/autoexec/wilderzoneClanClientQOL.cs.dso
//   before launching.

// client-side only: never load on a server/dedicated instance
if (isObject(ServerGroup))
   return;

// the QoL patch marks its client console patches with this package;
// without it the vanilla HTTPObject cannot do HTTPS and this client
// cannot talk to the community server at all
if (!isPackage(console_client_patches))
{
   error("wilderzoneClan QOL client requires the TribesNEXT QoL patch (HTTPS HTTPObject).");
   return;
}

// QOL flavor layer
exec("wzclans/settings.cs");
exec("wzclans/transport.cs");
exec("wzclans/sessionGlue.cs");

// shared layers (from client-common, merged into wzclans/ at vl2 build time)
exec("wzclans/launchTabs.cs");
exec("wzclans/cleanup.cs");
exec("wzclans/session.cs");
exec("wzclans/browser.cs");
exec("wzclans/mail.cs");
// browserUI.cs / mailUI.cs are exec'd by session.cs on first UUID: they modify
// stock GUI elements that do not exist yet at autoexec time

// optional loose override file (never shipped in the vl2): players can drop a
// GameData/base/wzclans/local.cs to override host/refresh settings
if (isFile("wzclans/local.cs"))
   exec("wzclans/local.cs");

// start the robot session negotiation (nonce -> challenge -> response -> UUID)
wzClans_login_initiate();
