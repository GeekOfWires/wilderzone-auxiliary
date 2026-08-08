// Wilderzone Clan Client - shared layer
// Launch tab re-activation
//
// The TribesNEXT QoL patch deliberately disables the WON-era EMAIL, BROWSER
// and CHAT launch tabs (console_client_patches.cs overrides
// LaunchTabView::addLaunchTab and forces %makeInactive for them - they were
// dead WON features). The community system replaces EMAIL (T-Mail) and
// BROWSER (clan browser) with working implementations, so those two tabs are
// re-enabled here. CHAT is left disabled (stock IRC, no community
// replacement).
//
// Why not override addLaunchTab: the QoL patch's override forces the inactive
// flag AFTER any outer package passes its argument, so wrapping that function
// cannot win. Instead we hook LaunchGui::onWake - which is where the stock
// code creates the tabs (scripts/LaunchLanGui.cs) - call Parent first so the
// tabs exist, then flip the community-backed ones back active.
//
// This file is flavor-neutral and safe to load at autoexec time: the package
// binds LaunchGui::onWake by name at call time.

package WZClansLaunchTabs
{
   function LaunchGui::onWake(%this)
   {
      Parent::onWake(%this);
      wzClans_enableLaunchTabs();
   }
};

if (!isActivePackage(WZClansLaunchTabs))
   activatePackage(WZClansLaunchTabs);

// flip the EMAIL and BROWSER tabs back to active, if they exist
function wzClans_enableLaunchTabs()
{
   if (!isObject(LaunchTabView))
      return;

   for (%i = 0; %i < LaunchTabView.tabCount(); %i++)
   {
      %gui = LaunchTabView.gui[%i];
      if ((isObject(EmailGui) && %gui == EmailGui) ||
          (isObject(TribeandWarriorBrowserGui) && %gui == TribeandWarriorBrowserGui))
         LaunchTabView.setTabActive(%i, true);
   }
}
