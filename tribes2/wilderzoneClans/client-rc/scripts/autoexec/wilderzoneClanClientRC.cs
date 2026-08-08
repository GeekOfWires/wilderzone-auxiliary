// Wilderzone Clan Client -- RC flavor entry point
//
// In-game clans and T-Mail for Tribes 2, via the TribesNEXT community system
// "robot" HTTP data interface originally written by Thyth and the TribesNext
// Project (t2-scripts, Copyright TribesNext Project 2011-2013). This mod is a
// conservative adaptation of those scripts, split into a shared layer
// (client-common/wzclans/) and this RC flavor layer, with credit to the
// original authors.
//
// Flavor: RC (ruby-capable TribesNEXT client). Transport, RSA challenge
// decryption, epoch time, and the login certificate come from
// wzclans/transport.cs (this flavor); everything else is shared code.
//
// Install:
//   Package the client-rc/ tree as a vl2 with the client-common/wzclans/ files
//   merged into the same wzclans/ directory, and drop the vl2 into the mod
//   folder. All exec paths below are relative to the mod directory root.
//   The RC2a patch must already be installed (it provides $LoginCertificate
//   and rubyEval).

if (isObject(ServerGroup))
	return; // client-side only

exec("wzclans/settings.cs");
exec("wzclans/transport.cs"); // RC flavor: hooks, Ruby HTTPS + TCPObject fallback
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

// initiate the community session negotiation
wzClans_login_initiate();
