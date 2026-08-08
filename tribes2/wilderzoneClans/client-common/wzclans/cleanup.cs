// Wilderzone Clan Client - shared layer
// Self-cleanup of compiled .dso shadows on exit
//
// The engine compiles every exec'd .cs to a loose .cs.dso next to the mod
// path, and prefers the compiled form on later launches. Because a vl2 is
// read-only, the .dso lands as a LOOSE file - and a stale one then silently
// shadows the vl2's updated .cs on the next run. This is the classic "my mod
// update didn't take effect" bug; Sierra's own launchers worked around it by
// deleting .dso files before launch.
//
// Instead, this mod deletes its OWN compiled shadows when the game exits:
// the stock onExit() hook (console_end.cs) is wrapped in a package, our
// cleanup runs, then Parent::onExit() preserves every other exit behavior
// (pref export, IRC quit, and any other mod's exit handling - including
// another tool that also deletes .dso files, which is harmless to us: we only
// ever delete our own paths, and deleteFile on a missing file is a no-op).
//
// This file is flavor-neutral and safe to load at autoexec time; the package
// binds onExit by name at call time.

package WZClansCleanup
{
   function onExit()
   {
      // disable switch (set in wzclans/local.cs) in case a platform/patch
      // combination objects to exit-time file deletion
      if ($WZClans::Community::CleanupDSOs $= "" || $WZClans::Community::CleanupDSOs)
         wzClansCleanupDSOs();
      Parent::onExit();
   }
};

if (!isActivePackage(WZClansCleanup))
   activatePackage(WZClansCleanup);

function wzClansCleanupDSOs()
{
   // collect the paths FIRST, delete AFTER the enumeration is closed:
   // deleting files while findFirstFile/findNextFile is still live crashes
   // the engine (the iterator's state is invalidated by deleteFile mid-loop -
   // observed as an access violation in the exit path on 2026-08)
   %n = 0;
   for (%f = findFirstFile("wzclans/*.dso"); %f !$= ""; %f = findNextFile("wzclans/*.dso"))
   {
      $WZClans::CleanupPath[%n] = %f;
      %n++;
   }
   for (%i = 0; %i < %n; %i++)
   {
      deleteFile($WZClans::CleanupPath[%i]);
      $WZClans::CleanupPath[%i] = "";
   }

   // the autoexec entry points live outside wzclans/
   if (isFile("scripts/autoexec/wilderzoneClanClientQOL.cs.dso"))
      deleteFile("scripts/autoexec/wilderzoneClanClientQOL.cs.dso");
   if (isFile("scripts/autoexec/wilderzoneClanClientRC.cs.dso"))
      deleteFile("scripts/autoexec/wilderzoneClanClientRC.cs.dso");
}
