// TribesNext Project
// http://www.tribesnext.com/
// Copyright 2011

// Tribes 2 Community System
// Robot Client Settings (RC flavor)

// This file contains the URL and server settings for the community system.

// Wilderzone adaptation notes:
//  - Adapted from the TribesNext t2-scripts settings.cs (TribesNext Project, 2011).
//  - Variables renamed from $TribesNext::Community:: to $WZClans::Community:: to avoid
//    collisions with any previously installed community scripts.
//  - This file is owned by the RC flavor (each flavor ships its own settings.cs;
//    the shared client-common layer owns everything else).
//  - The RC flavor talks plain HTTP on port 80 via TCPObject, exactly like the
//    original client. RC2a has no HTTPS path: TCPObject is plaintext-only and
//    the patch's embedded Ruby 1.9.0 has no socket/OpenSSL support (verified by
//    binary inspection of msvcrt-ruby190.dll / rubyintersect.dll).

$WZClans::Community::Host = "tribesnext.thyth.com";
$WZClans::Community::Port = 80;
$WZClans::Community::BaseURL = "/tn/robot/";

$WZClans::Community::LoginScript = "robot_login.php";
$WZClans::Community::MailScript = "robot_mail.php";
$WZClans::Community::BrowserScript = "robot_browser.php";

$WZClans::Community::SessionRefresh = 10*60;
