// TribesNext Project
// http://www.tribesnext.com/
// Copyright 2011-2013

// Tribes 2 Community System
// Robot Mail Client

// This script implements a network data interface to the TribesNext community system mail robot data interface.
// The "robot" data interface provides the data in a way that is easy to parse with the meager and medicore
// string processing and parsing features present in the Tribes 2 game. If you are reading this script and desire
// to make some sort of third party client for web access or other purposes, you will have a much easier time
// if you use the JSON API to access the same data.

// Wilderzone adaptation notes:
//  - Adapted from the TribesNext t2-scripts mail.cs (TribesNext Project, 2011-2013).
//  - All community identifiers renamed: $TribesNext::Community:: -> $WZClans::Community::
//    and tn_community_* -> wzClans_* (collision avoidance with older community scripts).
//  - TRANSPORT SPLIT: this shared file no longer creates the WZClansMailInterface
//    TCPObject and no longer builds raw HTTP request text. Requests are queued as
//    (path+query, POST payload) pairs in $TMailRequestQueue / $TMailPayloadQueue and
//    handed to the flavor hook wzClansHttpRequest("mail", %path, %payload). Responses
//    come back through wzClans_mail_onLine(%line) / wzClans_mail_onDisconnect(), which
//    the flavor calls via the shared wzClansOnLine/wzClansOnDisconnect dispatchers
//    after stripping HTTP headers.
//  - SEMANTIC CHANGE: wzClans_mail_requestCompleted() was originally invoked when the
//    HTTP headers ended; it is now invoked from wzClans_mail_onDisconnect(), i.e. when
//    the response has fully completed.
//  - $LoginCertificate reads now go through the flavor hook wzClansGetLoginCertificate().

// Currently available methods (as of RC3) are as follow:
//  - Viewing the inbox.
//  - Viewing the sentbox.
//  - Viewing the deleted messages box.
//  - Viewing messages.
//  - Viewing ignore list.
//  - Viewing buddy list.
//  - Adding users to an ignore list.
//  - Adding users to a buddy list.
//  - Deleting users from an ignore list.
//  - Deleting users from a buddy list.
//  - Deleting (and undeleting) messages.
//  - Getting a message count (both read and unread).
//  - Sending messages.

// Since the API is asynchronous, this interface will cache results to the various inboxes and viewed
// messages for the purposes of display. Temporary data (elipses) will be provided to the drawing code
// until all fields are filled in.

$WZClans::Community::Mail::Active = 0;
$WZClans::Community::Mail::ChunkSize = 25;

// Wilderzone: the flavor transport calls this (via wzClansOnDisconnect) when a
// mail response completes. The original invoked wzClans_mail_requestCompleted()
// at the end of the HTTP headers (the priming blank line); since the flavor now
// consumes the headers, the completion hook is invoked here instead, when the
// response has actually finished.
function wzClans_mail_onDisconnect()
{
	$WZClans::Community::Mail::Active = 0;
	wzClans_mail_requestCompleted();
	wzClans_mail_executeNextRequest();
}

// Wilderzone: the flavor transport calls this (via wzClansOnLine) once per
// response BODY line; HTTP header lines are consumed by the flavor transport.
function wzClans_mail_onLine(%line)
{
	warn("mail: " @ %line);
	%message = getField(%line, 0);
	switch$ (%message)
	{
		// display errors to the user -- some of these should never actually happen
		case "ERR":
			if (getField(%line, 1) $= "MAIL")
			{
				%type = getField(%line, 2);
				switch$ (%type)
				{
					case "INVALID_RECIP":
						%message = "Invalid recipient in mail send request.";
					case "INVALID_SBJ":
						%message = "Blank or invalid subject in mail send request.";
					case "INVALID_BODY":
						%message = "Blank or invalid body in message send request.";
					case "UNAUTHENTICATED":
						%message = "Session authentication error in mail request.";
					case "NO_METHOD":
						%message = "Internal error: no mail method specified in request.";
					case "UNKNOWN_METHOD":
						%message = "Internal error: unknown mail method specified in request.";
					case "READ":
						%message = "Access denied on message ID #" @ getField(%line, 3) @ ".";
					default:
						%message = "Unknown error in mail system: " @ %line;
				}
				schedule(500, 0, MessageBoxOK, "ERROR", %message);
			}
		// success is sent when a message is sent out
		case "SUCCESS":
			schedule(500, 0, MessageBoxOK, "SENT", "Your message has been sent.");

		// the rest of these should be handled and accepted quietly to populate the various data objects

		// message format sent as part of a box search
		case "MSG":
			%msg = wzClans_mail_getMessageObject(getField(%line, 1));
			%msg.box = getField(%line, 2);
			%msg.read = getField(%line, 3);
			%msg.type = getField(%line, 4);
			%msg.time = getField(%line, 5);

			%box = wzClans_mail_getMailboxObject(%msg.box);
			if (!%box.isMember(%msg))
			{
				if (%box.newest < %msg.id)
					%box.newest = %msg.id;
				%box.add(%msg);
			}

			// check if we're getting new messages
			if (%box.gettingNew)
			{
				%since = %box.since;
				if (%msg.id <= %since)
				{
					// found the desired message
					%box.gettingNew = 0;
					%box.since = %box.newest;
				}
				else
				{
					// not yet found desired message, try the next chunk

					// first make sure that the chunk exists and we're not at the end of the mailbox
					%box.chunk = %box.chunk + 1;
					if ($TMail::MessageBoxCount[%box.name] > (%box.chunk * $WZClans::Community::Mail::ChunkSize))
						wzClans_mail_request_boxList(%box.chunk * $WZClans::Community::Mail::ChunkSize, (%box.chunk + 1) * $WZClans::Community::Mail::ChunkSize, %box.name, %since);
					else
					{
						%box.since = %box.newest;
					}
				}
			}
		// message format sent as part of a message view
		case "MSG2":
			%msg = wzClans_mail_getMessageObject(getField(%line, 1));
			%msg.deleted = getField(%line, 2);
			%msg.type = getField(%line, 3);
			%msg.time = getField(%line, 4);
			%msg.read = "true";
		// message subject
		case "SBJ":
			wzClans_mail_getMessageObject(getField(%line, 1)).subject = getField(%line, 2);
		// sender of a message
		case "SNDR":
			wzClans_mail_getMessageObject(getField(%line, 1)).sender = wzClans_util_extractPlayer(%line, 2);
		// body of a message
		case "BDY":
			wzClans_mail_getMessageObject(getField(%line, 1)).body = collapseEscape(getField(%line, 2));
		// "to" recipient of a message
		case "TO":
			%msg = wzClans_mail_getMessageObject(getField(%line, 1));
			%index = getField(%line, 2);
			%msg.to[%index] = wzClans_util_extractPlayer(%line, 3);
			if (%msg.toMax < %index)
				%msg.toMax = %index;
		// "cc" recipient of a message
		case "CC":
			%msg = wzClans_mail_getMessageObject(getField(%line, 1));
			%index = getField(%line, 2);
			%msg.cc[%index] = wzClans_util_extractPlayer(%line, 3);
			if (%msg.ccMax < %index)
				%msg.ccMax = %index;
		// entries of a buddy or ignore list
		case "LIST":
			$TMail::ListVals[getField(%line, 1), getField(%line, 2)] = wzClans_util_extractPlayer(%line, 3);
			if ($TMail::ListMax[getField(%line, 1)] < getField(%line, 2))
				$TMail::ListMax[getField(%line, 1)] = getField(%line, 2);
		// search results for player name queries
		case "SEARCH":
			$TMail::SearchVals[getField(%line, 2)] = wzClans_util_extractPlayer(%line, 3);
			if ($TMail::SearchMax < getField(%line, 2))
				$TMail::SearchMax = getField(%line, 2);
		// unread message count for a box
		case "COUNT_U":
			$TMail::MessageBoxUnread[getField(%line, 1)] = getField(%line, 2);
		// message count for a box
		case "COUNT_A":
			$TMail::MessageBoxCount[getField(%line, 1)] = getField(%line, 2);
	}
}

// extract four fields from a string that correspond to a player
function wzClans_util_extractPlayer(%string, %fInit)
{
	return getField(%string, %fInit) @ "\t" @ getField(%string, %fInit + 1) @ "\t" @ getField(%string, %fInit + 2) @ "\t" @ getField(%string, %fInit + 3);
}

function wzClans_mail_getMessageObject(%id)
{
	if (isObject($TMail::MessageTable[%id]))
		return $TMail::MessageTable[%id];

	%obj = new SimObject()
	{
		class = TMailMessage;
		id = %id;
	};
	$TMail::MessageTable[%id] = %obj;

	$TMailMessageSet.add(%obj);
	return %obj;
}

function wzClans_mail_getMailboxObject(%name)
{
	if (isObject($TMail::MailboxTable[%name]))
		return $TMail::MailboxTable[%name];

	%obj = new SimSet()
	{
		class = TMailBox;
		name = %name;
		since = 0;
	};
	$TMail::MailboxTable[%name] = %obj;
	return %obj;
}

function wzClans_mail_initMessageSet()
{
	if (isObject($TMailMessageSet))
	{
		while ($TMailMessageSet.getCount() > 0)
			$TMailMessageSet.getObject(0).delete();
		$TMailMessageSet.delete();
	}
	$TMailMessageSet = new SimSet("TMailMessageSet");
}
wzClans_mail_initMessageSet();

function wzClans_mail_initQueue()
{
	// Wilderzone: queued entries are now (path+query, POST payload) pairs held in
	// two parallel vectors, instead of fully-formed HTTP request text
	if (isObject($TMailRequestQueue))
		$TMailRequestQueue.delete();
	$TMailRequestQueue = new MessageVector();
	if (isObject($TMailPayloadQueue))
		$TMailPayloadQueue.delete();
	$TMailPayloadQueue = new MessageVector();
}
wzClans_mail_initQueue();

function wzClans_mail_processRequest(%request, %payload)
{
	// Wilderzone: shared code now queues only the path+query (and the POST payload,
	// when present); the flavor transport builds and sends the actual HTTP request
	if (%request !$= "")
	{
		%request = "?guid=" @ getField(wzClansGetLoginCertificate(), 1) @ "&uuid=" @ $WZClans::Community::UUID @ "&" @  %request;
	}
	%path = $WZClans::Community::BaseURL @ $WZClans::Community::MailScript @ %request;

	$TMailRequestQueue.pushBackLine(%path);
	// MessageVector may not store truly empty lines; use a sentinel so the two
	// parallel queues can never desync (normalized back on pop)
	if (%payload $= "")
		%payload = " ";
	$TMailPayloadQueue.pushBackLine(%payload);

	if (!$WZClans::Community::Mail::Active)
		wzClans_mail_executeNextRequest();
}

function wzClans_mail_executeNextRequest()
{
	if ($TMailRequestQueue.getNumLines() <= 0)
		return;

	%path = $TMailRequestQueue.getLineText(0);
	$TMailRequestQueue.popFrontLine();
	%payload = $TMailPayloadQueue.getLineText(0);
	$TMailPayloadQueue.popFrontLine();
	if (%payload $= " ")
		%payload = "";

	$WZClans::Community::Mail::Active = 1;

	wzClansHttpRequest("mail", %path, %payload);
}

// implementation of API requests

// this isn't strictly an API request -- this gets the latest messages since the last check
function wzClans_mail_request_getNew(%box)
{
	%obj = wzClans_mail_getMailboxObject(%box);
	wzClans_mail_request_count(%box, "all");
	%since = %obj.since;
	%obj.gettingNew = 1;
	%obj.chunk = 0;
	wzClans_mail_request_boxList(0, $WZClans::Community::Mail::ChunkSize, %box, %since);
}

function wzClans_mail_request_boxList(%first, %last, %box, %since)
{
	wzClans_mail_processRequest("method=box&first=" @ %first @ "&last=" @ %last @ "&box=" @ %box @ "&since=" @ %since);
}

function wzClans_mail_request_read(%messageId)
{
	wzClans_mail_processRequest("method=read&id=" @ %messageId);
}

function wzClans_mail_request_viewList(%list)
{
	$TMail::ListMax[%list] = 0;
	deleteVariables("$TMail::ListVals" @ %list @ "*");
	wzClans_mail_processRequest("method=viewlist&list=" @ %list);
}

function wzClans_mail_request_addListEntry(%list, %target)
{
	wzClans_mail_processRequest("method=addlist&list=" @ %list @ "&target=" @ %target);
	wzClans_mail_request_viewList(%list); // refresh the list
}

function wzClans_mail_request_delListEntry(%list, %target)
{
	wzClans_mail_processRequest("method=dellist&list=" @ %list @ "&target=" @ %target);
	wzClans_mail_request_viewList(%list); // refresh the list
}

function wzClans_mail_request_deleteMessage(%messageId, %set)
{
	%msg = wzClans_mail_getMessageObject(%messageId);
	if (%set $= "0")
	{
		%add = "&set=0";
		%msg.deleted = "false";
	}
	else
	{
		%add = "&set=1";
		%msg.deleted = "true";
	}
	wzClans_mail_processRequest("method=delete&id=" @ %messageId @ %add);
	wzClans_mail_request_read(%messageId); // refresh the message status

	// move the message to the right box
	if (%set !$= "0")
	{
		// been deleted, make sure it's in the deleted set
		%box = wzClans_mail_getMailboxObject(%msg.box);
		%box.remove(%msg);
		wzClans_mail_getMailboxObject("deleted").add(%msg);
		%msg.box = "deleted";
	}
	else
	{
		// been undeleted? make sure it's not in the deleted set
		wzClans_mail_getMailboxObject("deleted").remove(%msg);
		if (getField(%msg.sender, 3) !$= getField(wzClansGetLoginCertificate(), 1))
			%box = wzClans_mail_getMailboxObject("inbox");
		else
			%box = wzClans_mail_getMailboxObject("sentbox");
		%box.add(%msg);
		%msg.box = %box.name;
	}
}

function wzClans_mail_request_count(%box, %mode)
{
	wzClans_mail_processRequest("method=count&box=" @ %box @ "&mode=" @ %mode);
}

function wzClans_mail_request_search(%query)
{
	$TMail::SearchMax = 0;
	deleteVariables("$TMail::SearchVals*");
	wzClans_mail_processRequest("method=search&query=" @ %query);
}

function wzClans_mail_request_send(%subject, %contents, %to, %cc)
{
	// sending messages themselves is done with a POST,
	// since the contents can be longer than URI length limits
	%guid = getField(wzClansGetLoginCertificate(), 1);
	%uuid = $WZClans::Community::UUID;

	%boundary = "-------------------------";
	%rand = getRandom(10000, 99999) @ getRandom(10000, 99999) @ getRandom(10, 9999);
	%formelem = "Content-Disposition: form-data; name=\"";

	%payload = "--" @ %boundary @ %rand @ "\r\n";

	// GUID element
	%payload = %payload @ %formelem @ "guid\"\r\n\r\n" @ %guid @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// UUID
	%payload = %payload @ %formelem @ "uuid\"\r\n\r\n" @ %uuid @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// method
	%payload = %payload @ %formelem @ "method\"\r\n\r\nsend\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// subject
	%payload = %payload @ %formelem @ "subject\"\r\n\r\n" @ %subject @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// contents
	%payload = %payload @ %formelem @ "contents\"\r\n\r\n" @ %contents @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// to
	%payload = %payload @ %formelem @ "to\"\r\n\r\n" @ %to @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	// cc
	if (trim(%cc) $= "")
		%cc = 0; // DarkDragonDX: No CC?
		
	%payload = %payload @ %formelem @ "cc\"\r\n\r\n" @ %cc @ "\r\n";
	%payload = %payload @ "--" @ %boundary @ %rand @ "\r\n";

	%header = "Content-Type: multipart/form-data; boundary=" @ %boundary @ %rand @ "\r\n";
	%header = %header @ "Content-Length: " @ strlen(%payload) @ "\r\n\r\n";

	wzClans_mail_processRequest("", %header @ %payload);
}

function wzClans_isOnList(%searchguid, %list)
{
	if ($TMail::ListMax[%list] $= "")
		return "";
	%count = $TMail::ListMax[%list];
	for (%i = 0; %i <= %count; %i++)
	{
		%player = $TMail::ListVals[%list, %i];
		%guid = getField(%player, 3);
		if (%guid == %searchguid)
			return %player;
	}
	return "";
}

function wzClans_isUserBuddy(%searchguid)
{
	return wzClans_isOnList(%searchguid, "buddy");
}

function wzClans_isUserBlocked(%searchguid)
{
	return wzClans_isOnList(%searchguid, "ignore");
}

// DarkDragonDX: Hookable script callback for when a request with the mail system completes
function wzClans_mail_requestCompleted(){ }

// DarkDragonDX: Helpers function to work with the JSON (somewhat)
function wzClans_mail_explodeJSONObject(%json)
{
	%json = trim(%json);
	%json = stripChars(%json, "{}\"'");
	// The EMail contents of a tribal invite shouldn't contain spaces so this should be safe
	%json = strReplace(%json, ",", " ");
	
	return %json;
}

// %processed should have been processed with wzClans_mail_explodeJSONObject
function wzClans_mail_getJSONElement(%processed, %element)
{
	%element = strlwr(%element);
	
	for (%i = 0; %i < getWordCount(%processed); %i++)
	{
		%word = strReplace(getWord(%processed, %i), ":", " ");
		if (strlwr(getWord(%word, 0)) $= %element)
			return getWord(%word, 1);
	}
	
	return -1;
}
