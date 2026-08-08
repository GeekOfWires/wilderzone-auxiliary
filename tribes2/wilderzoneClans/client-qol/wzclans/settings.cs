// Wilderzone Clan Client - QOL flavor
// Community server settings
//
// Adapted from the TribesNext Project robot client settings.cs
// (Copyright 2011 TribesNext Project, http://www.tribesnext.com/).
// QOL flavor by the Wilderzone project.
//
// This file contains the URL and server settings for the community system.
// Unlike the original client (plain HTTP on port 80 via TCPObject), the QOL
// flavor goes through the QoL patch's libcurl-backed HTTPObject, which speaks
// HTTPS. The port is therefore implicit: HTTPObject connects to 443 and does
// NOT take a port argument (see wzclans/transport.cs). $WZClans::Community::Port
// is kept only as documentation of the effective port.

$WZClans::Community::Host = "tribesnext.thyth.com";
$WZClans::Community::Port = 443; // implicit - HTTPObject has no port parameter
$WZClans::Community::BaseURL = "/tn/robot/";

$WZClans::Community::LoginScript = "robot_login.php";
$WZClans::Community::BrowserScript = "robot_browser.php";
$WZClans::Community::MailScript = "robot_mail.php";

// seconds between session keepalive refreshes (matches the original 10 minutes)
$WZClans::Community::SessionRefresh = 10*60;
