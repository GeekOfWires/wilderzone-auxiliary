// wilderzoneClanServer.cs
// Wilderzone pseudo-clan system - server-side tag provider for TribesNEXT QoL
// dedicated servers (base, Classic, TacoServer).
//
// A QOL-era, server-side reimagining of Thyth's tournamentNetClient2 community
// robot client (https://www.tribesnext.com/forum/discussion/3341/). Credit for
// the original community system: Electricutioner/Thyth and the TribesNext
// Project.
//
// How tags reach the scoreboard, in priority order:
//  1. Community certificates: players running a community client present a
//     signed cert during the t2csri handshake; the engine verifies it
//     natively. This plugin NEVER overrides those tags.
//  2. Local overrides: the server admin forces a tag for any account GUID in
//     prefs/wzClansConfig.cs ($WZClans::LocalTag[...]).
//  3. Wilderzone Auxiliary tag API: for everyone else, the plugin looks up
//     the player's public community profile (clan tag) via the worker at
//     wilderzone-aux.geekofwires.workers.dev and injects it into
//     GameConnection::getAuthInfo(), so the stock connect code bakes the tag
//     into the player name exactly like a real clan tag. Lookups are
//     asynchronous; a tag that arrives late is applied to the nameplate as
//     soon as it lands ($Host::WZClans::LateApply).
//
// The worker holds the TribesNEXT service account - game servers need NO
// TribesNEXT account of their own, and no player session data is involved.
//
// Requires the TribesNEXT QoL patch on the server for remote lookups (its
// libcurl-backed HTTPObject speaks HTTPS). Without it, only local overrides
// work.
//
// Install: drop wilderzoneClanQOL-server.vl2 in GameData/base/ (it is mounted
// for both -mod base and -mod Classic/TacoServer). The plugin deletes its own
// compiled .dso shadow on exit, so vl2 updates never need manual cleanup.
//
// Settings (all optional; $Host:: prefs persist via serverPrefs export):
//
// Master switch (1 = on)
// $Host::WZClans::Enable = 1;
// Tag API endpoint and key. The default is the shared generic WZA key
// (rate-limited per server IP by the service); get your own WZA API Key from
// the admin panel's WZA API Keys page for dedicated capacity. Set to "" to
// disable remote lookups entirely.
// $Host::WZClans::WorkerHost = "wilderzone-aux.geekofwires.workers.dev";
// $Host::WZAGenericKey = "wza_bfaa2ee74af5e90bdae2238a131b1c21";
// Seconds a fetched tag is cached (300) / a failed lookup is cached (60)
// $Host::WZClans::CacheTTL = 300;
// $Host::WZClans::NegCacheTTL = 60;
// Minimum milliseconds between API requests (be polite; 1000 default, 250 min)
// $Host::WZClans::MinRequestInterval = 1000;
// Apply a late-arriving tag to a connected player's name (1 = on)
// $Host::WZClans::LateApply = 1;
// Console spam for debugging (1 = on)
// $Host::WZClans::Debug = 0;
//
// Local overrides (also useful to force or hide tags). Set in
// GameData/<mod>/prefs/wzClansConfig.cs - that file is exec'd at startup and
// by /wzclansreload, and the engine never rewrites it (unlike serverPrefs.cs):
//    $WZClans::LocalTag[2000000] = "WZA";      // keyed by account GUID
//    $WZClans::LocalAppend[2000000] = 0;      // 0 = prepend, 1 = postpend
//
// Usage (super admins only):
// /wzclansreload  - reload the config file and re-fetch everyone connected.
//
// Notes:
//  - Smurfed players (chosen name != account name) get no tag, exactly like
//    stock clan tags.
//  - The scoreboard line refreshes on the next score update; the nameplate
//    above the player updates immediately on late apply.
//  - A removed override clears on the player's next connect.

/////////////////////////////////////////////////////////////////////////////
// Boot package: activate the core package only AFTER t2csri_server activates
/////////////////////////////////////////////////////////////////////////////

// t2csri_server is activated from t2csri/serverGlue.cs, which the QoL patch
// execs from its own CreateServer wrapper. Package activation order decides
// override order (last activated = outermost), and t2csri's getAuthInfo never
// calls Parent - so if we activated at autoexec time, our getAuthInfo would be
// shadowed and never run. Wrapping CreateServer lets us activate after the
// whole chain is up, making this package outermost. On unpatched servers this
// is harmless - the package simply wraps the stock getAuthInfo.

package WilderzoneClansServerBoot
{
   function CreateServer(%mission, %missionType)
   {
      Parent::CreateServer(%mission, %missionType);
      if (!isActivePackage(WilderzoneClansServer))
      {
         activatePackage(WilderzoneClansServer);
         echo("WZClans: server package active (tags apply on connect).");
      }
   }
};

if (!isActivePackage(WilderzoneClansServerBoot))
   activatePackage(WilderzoneClansServerBoot);

/////////////////////////////////////////////////////////////////////////////
// Core package: auth-info injection, connect hook, admin chat command
/////////////////////////////////////////////////////////////////////////////

package WilderzoneClansServer
{
   function GameConnection::getAuthInfo(%client)
   {
      %info = Parent::getAuthInfo(%client);
      return wzClansFilterAuthInfo(%client, %info);
   }

   function GameConnection::onConnect(%client, %name, %raceGender, %skin, %voice, %voicePitch)
   {
      Parent::onConnect(%client, %name, %raceGender, %skin, %voice, %voicePitch);

      // The scripted t2csri handshake fires onConnect twice per client (once
      // to start authentication, once to complete it); the QOL native
      // handshake fires it once with auth already done. %client.guid is set
      // by the stock onConnect in the Parent chain, so it only exists on the
      // real connect in BOTH paths - gate on that. (doneAuthenticating is NOT
      // set by the native path - verified by binary inspection of IFC22.dll.)
      if (%client.guid !$= "" && %client.guid != 0)
         wzClansOnClientReady(%client);
   }

   // deterministic fixation point: fires when the client has finished loading
   // and drops into the mission - patch-independent, and by then the lookup
   // queued at connect has usually completed
   function DefaultGame::clientMissionDropReady(%game, %client)
   {
      Parent::clientMissionDropReady(%game, %client);
      wzClansFixateTag(%client);
   }

   // TacoClassic's dtChatCmd package can swallow "/" commands without calling
   // Parent when its chatMessageAll lands on top - hook chatCmd as well (same
   // trick as gowWhoisVpn) so the command always lands.
   function chatMessageAll(%sender, %msgString, %a1, %a2, %a3, %a4, %a5, %a6, %a7, %a8, %a9, %a10)
   {
      %text = detag(%a2);
      if (%text $= "/wzclansreload")
      {
         wzClansChatCmd(%sender);
         return;
      }
      Parent::chatMessageAll(%sender, %msgString, %a1, %a2, %a3, %a4, %a5, %a6, %a7, %a8, %a9, %a10);
   }

   function chatCmd(%client, %message)
   {
      %command = strLwr(trim(getWord(detag(%message), 0)));
      if (%command $= "/wzclansreload")
      {
         wzClansChatCmd(%client);
         return;
      }
      Parent::chatCmd(%client, %message);
   }
};

/////////////////////////////////////////////////////////////////////////////
// Operator config file (local overrides) - never exported by the engine,
// never shipped in the vl2
/////////////////////////////////////////////////////////////////////////////

if (isFile("prefs/wzClansConfig.cs"))
   exec("prefs/wzClansConfig.cs");

/////////////////////////////////////////////////////////////////////////////
// Prefs (lazy defaults; $Host:: so they persist via serverPrefs export)
/////////////////////////////////////////////////////////////////////////////

function wzClansEnabled()
{
   if ($Host::WZClans::Enable $= "")
      $Host::WZClans::Enable = 1;
   return $Host::WZClans::Enable;
}

function wzClansWorkerHost()
{
   if ($Host::WZClans::WorkerHost $= "")
      $Host::WZClans::WorkerHost = "wilderzone-aux.geekofwires.workers.dev";
   return $Host::WZClans::WorkerHost;
}

// the generic WZA API key shared by generic WZA API functions; the default is
// the public rate-limited key, overridable with a dedicated key from the panel
function wzClansApiKey()
{
   if ($Host::WZAGenericKey $= "")
      $Host::WZAGenericKey = "wza_bfaa2ee74af5e90bdae2238a131b1c21";
   return $Host::WZAGenericKey;
}

function wzClansCacheTTL()
{
   if ($Host::WZClans::CacheTTL $= "")
      $Host::WZClans::CacheTTL = 300;
   return $Host::WZClans::CacheTTL;
}

function wzClansNegTTL()
{
   if ($Host::WZClans::NegCacheTTL $= "")
      $Host::WZClans::NegCacheTTL = 60;
   return $Host::WZClans::NegCacheTTL;
}

function wzClansMinInterval()
{
   if ($Host::WZClans::MinRequestInterval $= "")
      $Host::WZClans::MinRequestInterval = 1000;
   if ($Host::WZClans::MinRequestInterval < 250)
      $Host::WZClans::MinRequestInterval = 250;
   return $Host::WZClans::MinRequestInterval;
}

function wzClansLateApplyEnabled()
{
   if ($Host::WZClans::LateApply $= "")
      $Host::WZClans::LateApply = 1;
   return $Host::WZClans::LateApply;
}

function wzClansDebug()
{
   return ($Host::WZClans::Debug $= "1");
}

function wzClansDebugEcho(%msg)
{
   if (wzClansDebug())
      echo("WZClans: " @ %msg);
}

// remote lookups need the QoL patch's HTTPS HTTPObject (a key always exists -
// the generic default - but an operator can clear it to disable)
function wzClansRemoteEnabled()
{
   if (!wzClansEnabled() || $WZClans::RemoteDisabled)
      return false;
   return (wzClansApiKey() !$= "");
}

/////////////////////////////////////////////////////////////////////////////
// Auth info injection
/////////////////////////////////////////////////////////////////////////////

// Stock auth info record (tab fields, newline records):
//   >Name  ActiveClanTag  Prepend(0)/Postpend(1)Tag  guid
//   >NumberOfClans
//   >ClanName  TagForClan  Prepend(0)/Postpend(1)Tag  clanid  rank  title
// The stock connect code (scripts/server.cs, Classic/scripts/server.cs) reads
// fields 1/2 and bakes the tag into the player name. We only fill EMPTY clan
// fields - a client that presented a real community certificate keeps it.
function wzClansFilterAuthInfo(%client, %info)
{
   if (!wzClansEnabled() || %info $= "")
      return %info;

   // client presented a clan certificate (verified by t2csri) - authoritative
   if (getField(%info, 1) !$= "")
      return %info;

   %guid = getField(%info, 3);
   if (%guid $= "" || %guid == 0)
      return %info;

   // local override beats the API
   if ($WZClans::LocalTag[%guid] !$= "")
   {
      %info = setField(%info, 1, $WZClans::LocalTag[%guid]);
      %append = $WZClans::LocalAppend[%guid];
      if (%append $= "")
         %append = 0;
      %info = setField(%info, 2, %append);
      return %info;
   }

   if (wzClansCacheFresh(%guid) && $WZClans::Tag[%guid] !$= "")
   {
      %info = setField(%info, 1, $WZClans::Tag[%guid]);
      %info = setField(%info, 2, $WZClans::Append[%guid]);
   }
   return %info;
}

/////////////////////////////////////////////////////////////////////////////
// Tag cache
/////////////////////////////////////////////////////////////////////////////

function wzClansCacheFresh(%guid)
{
   if (!$WZClans::TagSeen[%guid])
      return false;
   %age = getSimTime() - $WZClans::TagTime[%guid];
   if ($WZClans::Tag[%guid] $= "")
      return (%age < wzClansNegTTL() * 1000);
   return (%age < wzClansCacheTTL() * 1000);
}

function wzClansCacheStore(%guid, %tag, %append, %name)
{
   $WZClans::TagSeen[%guid] = 1;
   $WZClans::Tag[%guid] = %tag;
   $WZClans::Name[%guid] = %name;
   $WZClans::TagTime[%guid] = getSimTime();
   if (%append $= "")
      %append = 0;
   $WZClans::Append[%guid] = %append;
}

/////////////////////////////////////////////////////////////////////////////
// Connect hook and late apply
/////////////////////////////////////////////////////////////////////////////

function wzClansOnClientReady(%client)
{
   if (!wzClansEnabled() || !isObject(%client) || %client.isAIControlled())
      return;

   %guid = %client.guid;
   if (%guid $= "" || %guid == 0)
      return;

   // already tagged - local override, fresh cache, or a presented cert
   if (getField(%client.getAuthInfo(), 1) !$= "")
   {
      // log tags we supplied (not cert-presented ones, which the engine handled)
      %tag = $WZClans::LocalTag[%guid];
      %src = "override";
      if (%tag $= "" && wzClansCacheFresh(%guid))
      {
         %tag = $WZClans::Tag[%guid];
         %src = "api";
      }
      if (%tag !$= "")
         echo("WZClans: " @ %client.nameBase @ " (guid " @ %guid @ ") tagged " @ %tag @ " on connect [" @ %src @ "]");
      return;
   }

   if (wzClansRemoteEnabled())
      wzClansQueueLookup(%guid);
}

// Fixation point at mission drop: if the tag was not baked in at connect but
// one is available now (override or a completed lookup), apply it before the
// player ever sees the scoreboard. If the lookup is still in flight, the
// fetch-completion late apply remains as the backstop.
function wzClansFixateTag(%client)
{
   if (!wzClansEnabled() || !isObject(%client) || %client.isAIControlled())
      return;

   %guid = %client.guid;
   if (%guid $= "" || %guid == 0)
      return;

   // already decorated? (baked at connect or cert-presented). Check the NAME,
   // not getAuthInfo - by now a completed lookup makes the filter report a
   // tag even though the name was never decorated. applyTagNow re-checks too.
   %raw = detag(getTaggedString(%client.name));
   if (getSubStr(%raw, 0, 2) $= "\cp")
      return;

   if ($WZClans::LocalTag[%guid] !$= "" || wzClansCacheFresh(%guid))
   {
      wzClansApplyTagNow(%client);
      return;
   }

   // nothing yet - make sure a lookup is queued (covers any path where the
   // connect hook did not fire)
   if (wzClansRemoteEnabled())
      wzClansQueueLookup(%guid);
}

// Rebuild a connected player's decorated name once their tag arrives.
// Mirrors the stock formats (scripts/server.cs "Add the tribal tag").
function wzClansApplyTagNow(%client)
{
   if (!isObject(%client) || %client.isSmurf)
      return;

   %guid = %client.guid;
   %tag = $WZClans::LocalTag[%guid];
   %append = $WZClans::LocalAppend[%guid];
   if (%tag $= "" && wzClansCacheFresh(%guid))
   {
      %tag = $WZClans::Tag[%guid];
      %append = $WZClans::Append[%guid];
   }
   if (%tag $= "")
      return;

   // never double-decorate (stock bake, a cert tag, or a previous apply)
   %raw = detag(getTaggedString(%client.name));
   if (getSubStr(%raw, 0, 2) $= "\cp")
      return;

   %name = stripChars(%raw, "\cp\co\c0\c1\c2\c3\c4\c5\c6\c7\c8\c9");
   if (%append)
      %name = "\cp\c6" @ %name @ "\c7" @ %tag @ "\co";
   else
      %name = "\cp\c7" @ %tag @ "\c6" @ %name @ "\co";

   %client.name = addTaggedString(%name);
   setTargetName(%client.target, %client.name);
   echo("WZClans: " @ %raw @ " (guid " @ %guid @ ") tagged " @ %tag @ " (late apply)");
}

function wzClansOnTagFetched(%guid)
{
   if (!wzClansLateApplyEnabled())
      return;
   if ($WZClans::Tag[%guid] $= "")
      return;

   for (%i = 0; %i < ClientGroup.getCount(); %i++)
   {
      %cl = ClientGroup.getObject(%i);
      // guid match implies fully authenticated (works for both the scripted
      // and the native QOL handshake - doneAuthenticating is script-path only)
      if (%cl.guid $= %guid && %cl.guid !$= "" && !%cl.isSmurf)
         wzClansApplyTagNow(%cl);
   }
}

/////////////////////////////////////////////////////////////////////////////
// Lookup queue (serialized, rate limited)
/////////////////////////////////////////////////////////////////////////////

function wzClansQueueLookup(%guid)
{
   if ($WZClans::QPending[%guid] || wzClansCacheFresh(%guid))
      return;
   if ($WZClans::LocalTag[%guid] !$= "")
      return;

   $WZClans::QPending[%guid] = 1;
   $WZClans::QGuid[$WZClans::QTail] = %guid;
   $WZClans::QTail++;

   if (!$WZClans::PumpScheduled)
   {
      $WZClans::PumpScheduled = 1;
      schedule(250, 0, wzClansPumpQueue);
   }
}

function wzClansPumpQueue()
{
   $WZClans::PumpScheduled = 0;

   if ($WZClans::QHead $= "")
      $WZClans::QHead = 0;
   if ($WZClans::QHead >= $WZClans::QTail)
   {
      // queue drained - reset indices
      $WZClans::QHead = 0;
      $WZClans::QTail = 0;
      return;
   }

   if (!wzClansRemoteEnabled())
      return; // a later reload/reconfigure re-queues

   if ($WZClans::HttpActive)
      return; // a request is already in flight; it re-pumps when done

   %guid = $WZClans::QGuid[$WZClans::QHead];
   $WZClans::QGuid[$WZClans::QHead] = "";
   $WZClans::QHead++;

   wzClansDebugEcho("looking up guid " @ %guid);

   $WZClans::HttpActive = 1;
   %http = new HTTPObject(WZClansTagHttp);
   %http.guid = %guid;
   %http.body = "";
   %http.done = 0;
   %http.setHeader("Accept", "text/plain");
   %http.setHeader("X-Tribes-Key", wzClansApiKey());
   %http.get(wzClansWorkerHost(), "/tribes-api/tag?guid=" @ %guid);
   // fail-safe cleanup if the request hangs
   %http.failSafe = %http.schedule(15000, "wzClansTimeout");
}

function wzClansPumpSoon()
{
   if (!$WZClans::PumpScheduled)
   {
      $WZClans::PumpScheduled = 1;
      schedule(wzClansMinInterval(), 0, wzClansPumpQueue);
   }
}

/////////////////////////////////////////////////////////////////////////////
// Tag lookup HTTP callbacks (QoL patch HTTPObject, HTTPS)
/////////////////////////////////////////////////////////////////////////////

function WZClansTagHttp::onLine(%this, %line)
{
   if (%this.done)
      return;
   %this.body = %this.body @ %line;
}

function WZClansTagHttp::onDisconnect(%this)
{
   if (%this.done)
      return;
   %this.done = 1;
   // never do heavy work or delete the object inside its own network
   // callback - deliver on a schedule instead (gowWhoisVpn pattern)
   %this.schedule(100, "wzClansDeliver");
}

function WZClansTagHttp::onDNSFailed(%this)
{
   wzClansHttpFail(%this, "DNS lookup failed");
}

function WZClansTagHttp::onConnectFailed(%this)
{
   wzClansHttpFail(%this, "connection failed");
}

function WZClansTagHttp::wzClansTimeout(%this)
{
   if (!%this.done)
      wzClansHttpFail(%this, "request timed out");
}

function wzClansHttpFail(%this, %why)
{
   %this.done = 1;
   echo("WZClans: tag lookup for guid " @ %this.guid @ " failed: " @ %why);
   // negative-cache briefly so an outage doesn't hammer the API
   wzClansCacheStore(%this.guid, "", "");
   $WZClans::HttpActive = 0;
   if (isObject(%this))
      %this.delete();
   wzClansPumpSoon();
}

// response body is a single tab-separated line:
//   OK \t name \t tag \t append  (append: 0 = prepend, 1 = postpend; empty tag = no clan)
//   ERR \t code                  (NOT_FOUND, BAD_KEY, RATE_LIMITED, UPSTREAM, ...)
function WZClansTagHttp::wzClansDeliver(%this)
{
   %guid = %this.guid;
   %body = %this.body;
   $WZClans::HttpActive = 0;
   if (isObject(%this))
      %this.delete();

   $WZClans::QPending[%guid] = 0;

   if (getField(%body, 0) $= "OK")
   {
      %name = getField(%body, 1);
      %tag = getField(%body, 2);
      %append = getField(%body, 3);
      wzClansCacheStore(%guid, %tag, %append, %name);
      wzClansDebugEcho("guid " @ %guid @ " name=\"" @ %name @ "\" tag=\"" @ %tag @ "\" append=" @ %append);
      wzClansOnTagFetched(%guid);
   }
   else
   {
      %err = getField(%body, 1);
      wzClansDebugEcho("lookup error for guid " @ %guid @ ": " @ %err);
      if (%err $= "BAD_KEY")
         echo("WZClans: the worker rejected $Host::WZAGenericKey - check your WZA API key.");
      // negative-cache everything else briefly (NOT_FOUND, RATE_LIMITED, ...)
      wzClansCacheStore(%guid, "", "");
   }

   wzClansPumpSoon();
}

/////////////////////////////////////////////////////////////////////////////
// Admin chat command
/////////////////////////////////////////////////////////////////////////////

function wzClansChatCmd(%sender)
{
   if (!%sender.isSuperAdmin)
      return;

   // reload the config file, clear the tag cache
   if (isFile("prefs/wzClansConfig.cs"))
      exec("prefs/wzClansConfig.cs");
   deleteVariables("$WZClans::Tag*");
   deleteVariables("$WZClans::Name*");
   deleteVariables("$WZClans::Append*");
   deleteVariables("$WZClans::QPending*");

   // re-fetch everyone connected
   for (%i = 0; %i < ClientGroup.getCount(); %i++)
   {
      %cl = ClientGroup.getObject(%i);
      if (%cl.guid !$= "" && %cl.guid != 0 && !%cl.isAIControlled())
         wzClansQueueLookup(%cl.guid);
   }

   messageClient(%sender, "msgChatCmd", "\c2WZClans: config reloaded, tag cache cleared - re-fetching connected players.");
}

/////////////////////////////////////////////////////////////////////////////
// Self-cleanup of compiled .dso shadows on exit
/////////////////////////////////////////////////////////////////////////////

// The engine compiles every exec'd .cs to a loose .cs.dso and prefers the
// compiled form on later launches - a stale loose .dso silently shadows this
// vl2's updated .cs. Wrap the stock onExit() hook (console_end.cs), delete
// our own compiled shadow, then Parent::onExit() preserves every other exit
// behavior (pref export, other mods, or another tool that also deletes .dso
// files - all harmless to us: we only ever delete our own path).

package WilderzoneClansServerCleanup
{
   function onExit()
   {
      if (isFile("scripts/autoexec/wilderzoneClanServer.cs.dso"))
         deleteFile("scripts/autoexec/wilderzoneClanServer.cs.dso");
      Parent::onExit();
   }
};

if (!isActivePackage(WilderzoneClansServerCleanup))
   activatePackage(WilderzoneClansServerCleanup);

/////////////////////////////////////////////////////////////////////////////
// Startup
/////////////////////////////////////////////////////////////////////////////

if (!isPackage(console_client_patches))
{
   error("WZClans: the TribesNEXT QoL patch is not active - remote tag lookups");
   error("WZClans: need its HTTPS HTTPObject. Local overrides still work.");
   $WZClans::RemoteDisabled = 1;
}

echo("WZClans: wilderzoneClan server plugin loaded, tag API host " @ wzClansWorkerHost());
