// TribesNext Project
// http://www.tribesnext.com/
// Copyright 2011-2013

// Tribes 2 Community System
// Mail UI Coercion

// This script implements connectivity between the Dynamix mail UI shipped with Tribes 2 and the community
// systems developed for TribesNext. The communication to the TribesNext systems via network is implemented
// in the robot client data interface script for mail. This script merely connects (modified) Dynamix UI
// elements to query/invoke methods on this new data interface, instead of the IRC server command used
// initially.

// Several functional changes were made as part of this process. Firstly, all players are now keyed by
// GUID instead of player name. Since player names are not immutable, it is foolish to use them in ways
// that assume they are. As a result of this change, the To/CC fields in the mail composition system do
// not accept input directly from a typing user. If there was a reasonable capability to implement auto
// completion, it may still have been possible to use this UI element. Instead, users will need to press
// the associated To/CC buttons to invoke the address book. From here, they can perform search by name,
// see their buddy list, see fellow members of their clans, and add players to the message (or buddy list).

// Second, deleted messages can now be undeleted for a duration. Messages marked as deleted are swept by the
// remote community system only at an interval. Users can undelete messages until this deletion process is
// run on the server. Users should not rely on the continued availability of deleted messages, since this
// sweep process can be run at any time.

// Thirdly, there were some hidden user interface elements that were intended for additional functionality,
// but apparently were never started by Dynamix. This includes a "Sent Item" view, which consists of messages
// sent by this user to other players. This has now been implemented, and connected to the previously hidden
// user interface widgets that were present before.

// Finally, the original Dynamix code would store mail messages in a local "webcache" file. Since the data
// used to populate these UIs now comes from another script data source, whose format completely differs from
// the original, and since the data format parsing facilities of the game are incredibly primitive, there is
// no longer any local file cache of mail messages.

// TODO add scroll handler to load more messages

// Wilderzone adaptation notes:
//  - Adapted from the TribesNext t2-scripts mailUI.cs (TribesNext Project, 2011-2013).
//  - All community identifiers renamed: $TribesNext::Community:: -> $WZClans::Community::
//    and tn_community_* -> wzClans_* (collision avoidance with older community scripts).
//    The memoization global $EpochMem was likewise renamed to $WZClansEpochMem.
//    Stock Dynamix GUI function/control names (EMailGui overrides, EMail_ToEdit,
//    EMail_CcEdit, EM_Browser, LC_Search, LC_ToList, etc.) are intentionally NOT
//    renamed -- this script hooks the stock mail UI by name, so the stock
//    scripts/webemail.cs and gui/EmailGui.gui must have been loaded BEFORE this
//    file is exec'd.
//  - wzClans_mailui_epochToDate() no longer uses rubyEval (shared code must be
//    ruby-free); it is a pure TorqueScript civil-date conversion and therefore
//    returns UTC rather than the client's local timezone.
//  - STOCK GUI DEPENDENCIES (must exist on the client; touched without isObject
//    guards, exactly as the original did): the stock EmailGui controls
//    EMail_ToEdit, EMail_CcEdit, EMail_Subject, EM_Browser, EM_BodyText, the
//    EM_ReplyBtn/EM_ReplyToAllBtn/EM_ForwardBtn/EM_DeleteBtn/EM_BlockBtn/
//    EM_BlockEditBtn buttons, the address-book controls LC_Search, LC_ToList,
//    LC_CcList, LC_BigList, LC_ListBox and their buttons, plus the
//    EmailComposeDlg and EmailBlockDlg dialogs.

$WZClans::Community::MailUI::ActiveMailbox = "inbox";
$WZClans::Community::MailUI::ActiveRow = -1;
$WZClans::Community::MailUI::Awake = 0;

// avoid sending garbage to the IRC server, just in case code is missed in the UI
function DatabaseQuery(%a0, %a1, %a2, %a3)
{
	error("Uncaught DatabaseQuery(" @ %a0 @ ", " @ %a1 @ ", " @ %a2 @ ", " @ %a3 @ ")");
}

function DatabaseQueryArray(%a0, %a1, %a2, %a3)
{
	error("Uncaught DatabaseQueryArray(" @ %a0 @ ", " @ %a1 @ ", " @ %a2 @ ", " @ %a3 @ ")");
}

function DatabaseQueryCancel(%a0, %a1, %a2, %a3)
{
	error("Uncaught DatabaseQueryCancel(" @ %a0 @ ", " @ %a1 @ ", " @ %a2 @ ", " @ %a3 @ ")");
}

function DatabaseQueryi(%a0, %a1, %a2, %a3)
{
	error("Uncaught DatabaseQueryi(" @ %a0 @ ", " @ %a1 @ ", " @ %a2 @ ", " @ %a3 @ ")");
}

// this function makes some (minor) changes to the Dynamix UI structure
function wzClans_mailui_modifyGUIData()
{
	// this UI element is present in the original UI, but it looks like it was never used
	rbSendItems.command = "EMailGui.ButtonClick(2);";
	rbSendItems.setVisible(1);

	// expand the delete button so that the text "UNDELETE" can be set comfortably
	EM_DeleteBtn.extent = "78 35";
	%shift = 13;
	EM_BlockEditBtn.position = (getWord(EM_DeleteBtn.position, 0) + 49 + %shift) SPC 42;
	EM_BlockBtn.position = (getWord(EM_DeleteBtn.position, 0) + 123 + %shift) SPC 42;

	// compose window settings changes
	EMail_Subject.maxLength = 250;

	// compose window -- making these effectively read only, the backing store must change
	EMail_ToEdit.maxLength = 0;
	EMail_ToEdit.validate = "wzClans_mailui_recipientValidate();";
	EMail_CcEdit.maxLength = 0;
	EMail_CcEdit.validate = "wzClans_mailui_recipientValidate();";

	// block list window settings, remove the unused UI element indicating number of blocks
	%panel = EmailBlockDlg.getObject(0);
	if (%panel.getCount() == 5)
		%panel.getObject(4).setText("");
	
}
wzClans_mailui_modifyGUIData();

// convert from data interface mail structure to the string expected by the Dynamix UI
function wzClans_mailui_convertMessage(%msg)
{
	%out = %msg.id @ "\n"; // id
	%out = %out @ %msg.sender @ "\n"; // from
	%out = %out @ (%msg.read $= "true") @ "\n"; // read flag
	%out = %out @ wzClans_mailui_epochToDate(%msg.time) @ "\n"; // send date

	if (%msg.body !$= "") // mail is loaded
	{
		// to, always at least one
		%count = %msg.toMax;
		for (%i = 0; %i <= %count; %i++)
			%to = %to @ "\t" @ %msg.to[%i];
		%to = getSubStr(%to, 1, strlen(%to));
		if (%msg.ccMax !$= "") // CC, if exists
		{
			%count = %msg.ccMax;
			for (%i = 0; %i <= %count; %i++)
				%cc = %cc @ "\t" @ %msg.cc[%i];
			%cc = getSubStr(%cc, 1, strlen(%cc));
		}
		%out = %out @ %to @ "\n" @ %cc @ "\n";
		%out = %out @ %msg.subject @ "\n";
		%out = %out @ %msg.body;
	}
	else
	{
		// don't have this message actually downloaded
		%out = %out @ "\n\n";
		%out = %out @ %msg.subject @ "\n";
		%out = %out @ "<font:Sui Generis:14><color:00cc00>Loading message. Please wait...";
	}
}

// produces a list of recipients suitable for UI display
function wzClans_mailui_recipientShowList(%list, %color)
{
	%entries = getFieldCount(%list);
	%showList = "";
	for (%i = 0; %i < %entries; %i += 4)
	{
		%name = getField(%list, %i);
		%tag = getField(%list, %i + 1);
		%append = getField(%list, %i + 2);
		%guid = getField(%list, %i + 3);

		if (%color)
		{
			%name = "\c0" @ %name @ "\c3";
			%tag = "\c2" @ %tag @ "\c3";
		}

		%showName = (%append ? (%name @ %tag) : (%tag @ %name));
		%showList = %showList @ ", " @ %showName;
	}
	return getSubStr(%showList, 2, strlen(%showList));
}

function wzClans_mailui_recipientValidate()
{
	Email_ToEdit.setText(wzClans_mailui_recipientShowList(Email_ToEdit.backing, 1));
	Email_CCEdit.setText(wzClans_mailui_recipientShowList(Email_CCEdit.backing, 1));
}

function wzClans_mailui_epochToDate(%epoch)
{
	// Wilderzone: the original used ruby Time.at().strftime(), since T2 does not expose
	// the local system timezone. Shared Wilderzone code must not call rubyEval, so this
	// is now a pure TorqueScript civil-date conversion (Howard Hinnant's algorithm).
	// Caveat versus the original: the result is UTC, not the client's local timezone.
	// The math below avoids TorqueScript's %g float stringification entirely: % and -
	// are integer-exact, and (%epoch - %secs) is divisible by 86400, so the division
	// is exact too (a naive %epoch / 86400 float divide would quantize to 0.1-day
	// steps and could even display hour 24 near midnight UTC).

	// verify %epoch uses only numbers for security reasons
	%len = strlen(%epoch);
	for (%i = 0; %i < %len; %i++)
	{
		%char = strcmp(getSubStr(%epoch, %i, 1), "");
		if (%char > 0x39 || %char < 0x30)
		{
			%epoch = 0;
			break;
		}
	}

	// check memoization table
	%mem = $WZClansEpochMem[%epoch];
	if (%mem !$= "")
		return %mem;

	// split into whole days and seconds-of-day with integer-exact operations
	%secs = %epoch % 86400;
	%days = (%epoch - %secs) / 86400;

	%hh = mFloor(%secs / 3600);
	%mm = mFloor((%secs - %hh * 3600) / 60);
	%ss = %secs - %hh * 3600 - %mm * 60;

	// civil calendar date from day count (Hinnant's civil_from_days)
	%z = %days + 719468;
	%era = mFloor(%z / 146097);
	%doe = %z - %era * 146097;
	%yoe = mFloor((%doe - mFloor(%doe / 1460) + mFloor(%doe / 36524) - mFloor(%doe / 146096)) / 365);
	%year = %yoe + %era * 400;
	%doy = %doe - (365 * %yoe + mFloor(%yoe / 4) - mFloor(%yoe / 100));
	%mp = mFloor((5 * %doy + 2) / 153);
	%day = %doy - mFloor((153 * %mp + 2) / 5) + 1;
	if (%mp < 10)
		%month = %mp + 3;
	else
		%month = %mp - 9;
	if (%month <= 2)
		%year = %year + 1;

	// zero-pad and format as "%Y-%m-%d %H:%M:%S", like the original
	if (%month < 10)
		%month = "0" @ %month;
	if (%day < 10)
		%day = "0" @ %day;
	if (%hh < 10)
		%hh = "0" @ %hh;
	if (%mm < 10)
		%mm = "0" @ %mm;
	if (%ss < 10)
		%ss = "0" @ %ss;
	%out = %year @ "-" @ %month @ "-" @ %day @ " " @ %hh @ ":" @ %mm @ ":" @ %ss;

	// memoize then return
	$WZClansEpochMem[%epoch] = %out;
	return %out;
}

function wzClans_mailui_clearCheckStatus()
{
	if (isEventPending($WZClans::Community::MailUi::StatusSchedule))
		cancel($WZClans::Community::MailUi::StatusSchedule);

	if ($WZClans::Community::Mail::Active)
	{
		$WZClans::Community::MailUi::StatusSchedule = schedule(32, 0, wzClans_mailui_clearCheckStatus);
		return;
	}
	EmailGui.checkingEmail = 0;

	$WZClans::Community::MailUI::ActiveRow = EM_Browser.getSelectedId();
	wzClans_mailui_displayBox($WZClans::Community::MailUI::ActiveMailbox);

	if (EmailBlockDlg.gettingList)
	{
		wzClans_mailui_displayBlockList();
		EmailBlockDlg.gettingList = 0;
	}
	if (AddressDlg.searchActive)
	{
		wzClans_mailui_displaySearchResults();
		AddressDlg.searchActive = 0;
	}
	error("Mail UI update.");
}

function wzClans_mailui_displayBox(%mailbox)
{
	EmailMessageVector.clear();
	EM_Browser.clearList();
	$EmailNextSeq = 0;
	EMailInboxBodyText.setText("");

	if (%mailbox $= "deleted") // set delete button to undelete mode in deleted items
		EM_DeleteBtn.text = "UNDELETE";
	else
		EM_DeleteBtn.text = "DELETE";

	%box = wzClans_mail_getMailboxObject(%mailbox);
	%count = %box.getCount();
	for (%i = 0; %i < %count; %i++)
	{
		%msg = %box.getObject(%i);
		%id = %msg.id;
		EmailNewMessageArrived(wzClans_mailui_convertMessage(%msg), %id);
	}
	EM_Browser.selectRowByID($WZClans::Community::MailUI::ActiveRow);

	EM_Browser.sort();
}

function wzClans_mailui_loadSelected()
{
	if (isEventPending($WZClans::Community::MailUi::SelectLoadSchedule))
		cancel($WZClans::Community::MailUi::SelectLoadSchedule);

	if ($WZClans::Community::MailUI::Awake)
	{
		%id = EM_Browser.getSelectedId();
		if (%id != -1)
		{
			%msg = wzClans_mail_getMessageObject(%id);
			if (%msg.body $= "" && !%msg.uiRequested)
			{
				%msg.uiRequested = 1;
				wzClans_mail_request_read(%id);
				wzClans_mailui_clearCheckStatus();
			}
		}
		$WZClans::Community::MailUi::SelectLoadSchedule = schedule(250, 0, wzClans_mailui_loadSelected);
	}
}

// replacing function in webbrowser.cs, 571
function LinkEMail(%MailTo)
{
	%count = getRecordCount(%MailTo);
	%recipients = "";
	for (%i = 0; %i < %count; %i++)
	{
		%record = getRecord(%MailTo, %i);
		%guid = getField(%record, 0);
		%name = getField(%record, 1);
		%tag = getField(%record, 2);
		%append = getField(%record, 3);

		%player = wzClans_browser_getPlayerProfile(%guid);
		if (%name $= "")
			%name = %player.name;
		if (%tag $= "")
		{
			%tag = getField(%player.tag, 0);
			%append = getField(%player.tag, 1);
		}
		if (%append $= "")
			%append = 0;
		%recipient = %name TAB %tag TAB %append TAB %guid @ "\t";
		%recipients = %recipients @ %recipient;
	}
	%recipients = trim(%recipients);
	Email_ToEdit.backing = %recipients;
	Email_ToEdit.setText(wzClans_mailui_recipientShowList(Email_ToEdit.backing, 1));

	//Email_ToEdit.setText(%MailTo);
	Email_CCEdit.setText("");
	$EmailSubject = "";
	Canvas.pushDialog(EmailComposeDlg);
	EmailBodyText.setValue("");
	Email_Subject.makeFirstResponder(1);
}

// replacing function in webemail.cs, 369
function CheckEmail(%schedule)
{
	if ($WZClans::Community::UUID $= "") // session not established
		return;
	if (EmailGui.checkingEmail)
		return;

	if (isEventPending(EmailGui.checkSchedule) && !%scheduled)
		cancel(EmailGui.checkSchedule);

	EmailGui.checkSchedule = "";
	EMailGui.key = LaunchGui.key++;
	EmailGui.state = "getMail";
	EmailGui.checkingEmail = true;

	// new code
	if (EMailGui.initialDownloaded)
	{
		// initial messages have already been downloaded -- get updates
		wzClans_mail_request_getNew("inbox");
		wzClans_mail_request_getNew("sentbox");
		wzClans_mail_request_getNew("deleted");
	}
	else
	{
		// no initial messages downloaded yet -- get first chunk
		// this will limit messages to the first chunk in each mailbox
		// and further messages can be downloaded as the user scrolls to the bottom
		EMailGui.initialDownloaded = 1;
		wzClans_mail_request_boxList(0, $WZClans::Community::Mail::ChunkSize, "inbox", 0);
		wzClans_mail_request_boxList(0, $WZClans::Community::Mail::ChunkSize, "sentbox", 0);
		wzClans_mail_request_boxList(0, $WZClans::Community::Mail::ChunkSize, "deleted", 0);
	}
	wzClans_mailui_clearCheckStatus();
}

// replacing function in webemail.cs, 1319
function EM_Browser::onSelect(%this, %id)
{
	wzClans_mailui_loadSelected();

	%text = EmailMessageVector.getLineTextByTag(%id);
	if (rbinbox.getValue())
	{
		if(!getRecord(%text, 2)) // read flag
		{
			%line = EmailMessageVector.getLineIndexByTag(%id);
			%text = setRecord(%text, 2, 1);

			// Update the GUI:
			%this.setRowFlags( %id, 1 );
			EmailMessageVector.deleteLine(%line);
			EmailMessageVector.insertLine(%line, %text, %id);
		}
	}
	EmailInboxBodyText.setValue(EmailGetTextDisplay(%text));
	EM_ReplyBtn.setActive( true );
	EM_ReplyToAllBtn.setActive( true );
	EM_ForwardBtn.setActive( true );
	EM_DeleteBtn.setActive( true );
	EM_BlockBtn.setActive( true );
}

// replacing function in webemail.cs, 297
function EmailGetTextDisplay(%text)
{
	// get ID to check some additional properties
	%id = getRecord(%text, 0);
	%msg = wzClans_mail_getMessageObject(%id);
	if (%msg.deleted $= "true")
		%prepend = "<spush><font:Sui Generis:14><color:cc0000>Message has been deleted and will be removed from the mail system soon.<spop>\n";

	%toList = getRecord(%text, 4);
	%to = getLinkNameList(%toList);
	%ccList = getRecord(%text, 5);
	%ccLine = getLinkNameList(%ccList);
	
	// DarkDragonDX: Check if it's a tribal invite
	%subjectLine = getRecord(%text, 6);
	%emailContents = EmailGetBody(%text);
	%senderName = getLinkName(getRecord(%text, 1), 0);
	
	if (getWords(%subjectLine, 0, 1) $= "Invitation to:")
	{
		%emailContents = wzClans_mail_explodeJSONObject(%emailContents);
		%clanID = wzClans_mail_getJSONElement(%emailContents, "clanid");
		%expiration = wzClans_mail_getJSONElement(%emailContents, "expire");	
		
		%emailContents = %senderName SPC "of clan \"" @ trim(getWords(%subjectLine, 2)) @ "\" has invited you to join their clan." NL
		"<a:acceptinvite-" @ %clanID @ ">Accept</a> or <a:rejectinvite-" @ %clanID @ ">Reject</a> the invitation? This invitation expires at <spush><color:ADFFFA>" @ wzClans_mailui_epochToDate(%expiration) @ "<spop>.";
	}

	%from = %senderName;
	%msgtext = "From: " @ %from NL
		"To: " @ %to NL
		"CC: " @ %ccLine NL
		"Subject: " @ %subjectLine NL
		"Date Sent: " @ getRecord(%text, 3) @ "\n\n" @
		%emailContents;

	return %prepend @ %msgtext;
}

// replacing function in webemail.cs, 401
function EmailEditBlocks()
{
	// this function is called when bringing up the block list editor
	// -- initially this initiated a database query that would populate the UI
	//    as it was recieved. instead, this will be dealt with during the rest of the UI update
	Canvas.pushDialog(EmailBlockDlg);
	EmailBlockList.clear();
	EMailBlockDlg.key = LaunchGui.key++;
	EmailBlockDlg.state = "getBlocklist";

	EmailBlockDlg.gettingList = 1;

	wzClans_mail_request_viewList("ignore");
	wzClans_mailui_clearCheckStatus();
}

function wzClans_mailui_displayBlockList()
{
	// update the block list UI from the data interface cache
	if ($TMail::ListMax["ignore"] $= "")
		return;
	%count = $TMail::ListMax["ignore"];
	for (%i = 0; %i <= %count; %i++)
	{
		%player = $TMail::ListVals["ignore", %i];

		%name = getField(%player, 0);
		%tag = getField(%player, 1);
		%append = getField(%player, 2);
		%guid = getField(%player, 3);

		%showName = (%append ? (%name @ %tag) : (%tag @ %name));
		EmailBlockList.addRow(%guid, %showName);
	}
}

// replacing function in webemail.cs, 410
function EmailBlockSender()
{
	%id = EM_Browser.getSelectedId();
	if ( %id == -1 )
	{		
		MessageBoxOK("WARNING","You cannot block a non-existent sender.");
		return;
	}
	else
	{
		%text = EmailMessageVector.getLineTextByTag(EM_Browser.getSelectedId());
		%blockUser = getRecord(%text, 1);

		%name = getField(%blockUser, 0);
		%tag = getField(%blockUser, 1);
		%append = getField(%blockUser, 2);
		%guid = getField(%blockUser, 3);

		%showName = (%append ? (%name @ %tag) : (%tag @ %name));
		MessageBoxYesNo("CONFIRM BLOCK","Are you sure you want to block " @ %showName @ "?","wzClans_mail_request_addListEntry(\"ignore\", " @ %guid @ ");");
	}
}

// replacing function in webemail.cs, 431
function EmailBlockRemove()
{
	%rowId = EmailBlockList.getSelectedId();
	if(%rowId == -1)
	{
		MessageBoxOK("WARNING","You cannot remove a non-existent block.");
		return;
	}
	else
	{
		%line = EmailBlockList.getRowTextById(%rowId);
		%name = getField(%line, 2);
		EMailBlockDlg.state = "removeBlock";
		EMailBlockDlg.key = LaunchGui.key++;
		EmailBlockList.removeRowById(%rowId);

		wzClans_mail_request_delListEntry("ignore", %rowId);
	}
}

// replacing function in webemail.cs, 43
function EmailMessageNew()
{
	Email_ToEdit.backing = "";
	Email_ToEdit.setText("");
	Email_CCEdit.backing = "";
	Email_CCEdit.setText("");
	$EmailSubject = "";
	EmailBodyText.setValue("");

	EMailComposeDlg.state = "sendMail";
	Canvas.pushDialog(EmailComposeDlg);
	Email_ToEdit.makeFirstResponder(1);
}

// replacing function in webemail.cs, 55
function EmailMessageReply()
{
	EMailComposeDlg.state = "replyMail";
	%text = EmailMessageVector.getLineTextByTag( EM_Browser.getSelectedId() );
	Email_ToEdit.backing = getRecord(%text, 1);
	Email_ToEdit.setText(wzClans_mailui_recipientShowList(Email_ToEdit.backing, 1));
	Email_CCEdit.backing = "";
	Email_CCEdit.setText("");
	$EmailSubject = "RE: " @ getRecord(%text, 6);
	%date = getRecord(%text, 3);
	Canvas.pushDialog(EmailComposeDlg);

	%player = Email_ToEdit.getValue();
	%name = getField(%player, 0);
	%tag = getField(%player, 1);
	%append = getField(%player, 2);
	%guid = getField(%player, 3);

	%showName = (%append ? (%name @ %tag) : (%tag @ %name));

	EmailBodyText.setValue("\n\n----------------------------------\n On " @ %date SPC %showName @ " wrote:\n\n" @ EmailGetBody(%text) );
	EmailBodyText.SetCursorPosition(0);
	EmailBodyText.makeFirstResponder(1);
}

function EmailMessageForward()
{
	%text = EmailMessageVector.getLineTextByTag( EM_Browser.getSelectedId() );
	Email_ToEdit.backing = "";
	Email_ToEdit.setText("");
	Email_CCEdit.backing = "";
	Email_CCEdit.setText("");
	$EmailSubject = "FW: " @ getRecord(%text, 6);
	Canvas.pushDialog(EmailComposeDlg);
	EmailBodyText.setValue("\n\n\n--- Begin Forwarded Message ---\n\n" @ EmailGetTextDisplay(%text));
	Email_toEdit.makeFirstResponder(1);
	EmailBodyText.SetCursorPosition(0);
	EMailComposeDlg.state = "forwardMail";
}
// replacing function in webemail.cs, 82
function EmailMessageReplyAll()
{
	EMailComposeDlg.state = "replyAll";
	%text = EmailMessageVector.getLineTextByTag( EM_Browser.getSelectedId() );
	Email_ToEdit.backing = getRecord(%text, 1);
	Email_ToEdit.setText(wzClans_mailui_recipientShowList(Email_ToEdit.backing, 1));
	Email_CCEdit.backing = getRecord(%text, 4) @ "\t" @ getRecord(%text,5);
	Email_CCEdit.setText(wzClans_mailui_recipientShowList(Email_CCEdit.backing, 1));
	$EmailSubject = "RE: " @ getRecord(%text, 6);
	%date = getRecord(%text, 3);
	Canvas.pushDialog(EmailComposeDlg);

	%player = Email_ToEdit.getValue();
	%name = getField(%player, 0);
	%tag = getField(%player, 1);
	%append = getField(%player, 2);
	%guid = getField(%player, 3);

	%showName = (%append ? (%name @ %tag) : (%tag @ %name));

	EmailBodyText.setValue("\n\n===========================\n On " @ %date SPC %showName @ " wrote:\n\n" @ EmailGetBody(%text) );
	EmailBodyText.makeFirstResponder(1);
	EmailBodyText.SetCursorPosition(0);
}

// replacing function in webemail.cs, 145
function EmailSend()
{
	EMailComposeDlg.key = LaunchGui.key++;
	EMailComposeDlg.state = "sendMail";

	%to = wzClans_mailui_extractRecipientIds(Email_ToEdit.backing);
	%cc = wzClans_mailui_extractRecipientIds(Email_CCEdit.backing);
	%subj = $EmailSubject;
	%text = EMailBodyText.getValue();

	wzClans_mail_request_send(%subj, %text, %to, %cc);
	Canvas.popDialog(EmailComposeDlg);

	// run checkemail to update the list of messages in the mailboxes
	CheckEmail();
}

function wzClans_mailui_extractRecipientIds(%recipients)
{
	%entries = getFieldCount(%recipients);
	%guidList = "";
	for (%i = 0; %i < %entries; %i += 4)
	{
		%name = getField(%recipients, %i);
		%tag = getField(%recipients, %i + 1);
		%append = getField(%recipients, %i + 2);
		%guid = getField(%recipients, %i + 3);

		%guidList = %guidList @ "," @ %guid;
	}
	return getSubStr(%guidList, 1, strlen(%guidList));
}

// replacing function in webemail.cs, 96
function EmailMessageDelete()
{
	%id = EM_Browser.getSelectedId();
	if ( %id == -1 )
		return;

	EMailComposeDlg.key = LaunchGui.key++;

	// Make these buttons inactive until another message is selected:
	%state = 1;
	if ($WZClans::Community::MailUI::ActiveMailbox $= "deleted")
		%state = 0;
	DoEmailDelete(%id, %state);
}

// replacing function in webemail.cs, 121
function DoEmailDelete(%mid, %state)
{
	%row = EM_Browser.findById(%mid);

	EM_ReplyBtn.setActive( false );
	EM_ReplyToAllBtn.setActive( false );
	EM_ForwardBtn.setActive( false );
	EM_DeleteBtn.setActive( false );
	EM_BlockBtn.setActive( false );

	EM_Browser.removeRowByIndex(%row);
	EmailMessageVector.deleteLine(EmailMessageVector.getLineIndexByTag(%mid));

	if ( EM_Browser.rowCount() == 0 )
		EMailInboxBodyText.setText("");
	else
		EM_Browser.setSelectedRow(%row);

	wzClans_mail_request_deleteMessage(%mid, %state);
	wzClans_mailui_clearCheckStatus();
}

// replacing function in webemail.cs, 1229
function EmailGui::loadCache(%this) { }
// replacing function in webemail.cs, 1274
function EmailGui::dumpCache(%this) { }
// replacing function in webemail.cs, 1174
function EmailGui::getCache(%this) { %this.cacheLoaded = true; }

// addressdlg related functions in webemail

// replacing function in webemail.cs, 823
function AddressDlg::GoSearch(%this)
{
	if(trim(LC_Search.getValue()) !$="")
	{
		%this.key = LaunchGui.key++;
		%this.state = "goSearch";
		%this.lbstate = "errorcheck";
		LC_BigList.mode = "select";

		// searching via mail API
		LC_BigList.clear();
		AddressDlg.searchActive = 1;
		wzClans_mail_request_search(LC_Search.getValue());
		wzClans_mailui_clearCheckStatus();

		LC_BuddyListBtn.direction = 0;
		LC_BuddyListBtn.text = "ADD TO BUDDYLIST";
		LC_ListBox.setSelected(0);
	}
	else
		MessageBoxOK("DENIED", "Blank searches for player names are not permitted. Please enter the start of the player name you are seeking.");
}

function wzClans_mailui_displaySearchResults()
{
	if (LC_BigList.mode $= "select" || LC_BigList.mode $= "")
	{
		// update the search UI from the data interface cache
		if ($TMail::SearchMax $= "")
			return;
		%count = $TMail::SearchMax;
		for (%i = 0; %i <= %count; %i++)
		{
			%player = $TMail::SearchVals[%i];
			%guid = getField(%player, 3);

			if (%guid !$= "")
				LC_BigList.addRow(%guid, %player);
		}
	}
	else if (LC_BigList.mode $= "buddy")
	{
		// update the block list UI from the data interface cache
		if ($TMail::ListMax["buddy"] $= "")
			return;
		%count = $TMail::ListMax["buddy"];
		for (%i = 0; %i <= %count; %i++)
		{
			%player = $TMail::ListVals["buddy", %i];
			%guid = getField(%player, 3);
			if (%guid !$= "")
				LC_BigList.addRow(%guid, %player);
		}
	}
}

// replacing function in webemail.cs, 742
function AddressDlg::AddBuddylist(%this)
{
	%this.key = LaunchGui.key++;
	%this.lbstate = "buddylist";

	switch (%this.SrcList)
	{
		case 0:
			%addremove = LC_BuddyListBtn.direction;
			%player = LC_BigList.getValue();
			%selRow = LC_BigList.getRownumByID(LC_BigList.GetSelectedID());
		case 1:
			%addremove = 0;
			%player = LC_ToList.getValue();
		case 2:
			%addremove = 0;
			%player = LC_CCList.getValue();
	}
	%guid = getField(%player, 3);

	if (%guid !$= "")
	{
		if (%addremove==0)
		{
			%this.doRefresh = 1;
			%this.state = "addBuddy";
			wzClans_mail_request_addListEntry("buddy", %guid);
 			//DatabaseQuery(10,%player,%this,%this.key);
		}
		else
		{    
			%this.state = "dropBuddy";
			wzClans_mail_request_delListEntry("buddy", %guid);
			//DatabaseQuery(11,%player,%this,%this.key);
			LC_BigList.removeRowbyId(LC_BigList.getSelectedID());
			if(%selRow>=LC_BigList.RowCount())
				%selRow = LC_BigList.RowCount()-1;
			LC_BigList.setSelectedRow(%selRow);
		}
	}
	else
	{
		error("Trying to modify buddy list on player data missing GUID: " @ %player);
	}
}

// replacing function in webemail.cs, 839
function AddressDlg::GoList(%this)
{
	%this.key = LaunchGui.key++;
	%this.lbstate = "errorcheck";
	if(LC_ListBox.getValue() $= "Select List")
	{
		LC_BigList.mode = "select";
		LC_BigList.clear();
	}
	else if(LC_ListBox.getValue() $= "Buddy List")
	{
		LC_BigList.mode = "buddy";
		LC_BigList.clear();
		%this.state = "getBuddyList";
		AddressDlg.searchActive = 1;
		wzClans_mail_request_viewList("buddy");
		LC_BuddyListBtn.direction = 1;
		LC_BuddyListBtn.text = "REMOVE FROM BUDDYLIST";
	}
	else
	{
		LC_BigList.mode = "clan";
		LC_BigList.clear();

		LC_BuddyListBtn.direction = 0;
		LC_BuddyListBtn.text = "ADD TO BUDDYLIST";

		%clanid = LC_ListBox.getSelected();
		%clan = wzClans_browser_getClanProfile(%clanid);

		%pcount = %clan.pcount;
		if (%pcount !$= "")
		{
			for (%i = 0; %i <= %pcount; %i++)
			{
				%member = %clan.player[%i];
				%mguid = getField(%member, 3);
				if (%mguid != getField(WONGetAuthInfo(), 3))
					LC_BigList.addRow(%mguid, getFields(%member, 0, 3));
			}
		}
	}
	wzClans_mailui_clearCheckStatus();
}

// replacing function in webemail.cs, 777
function AddressDlg::AddCC(%this)
{
	if(LC_CCListBtn.direction == 0)
	{
		%addName = LC_BigList.getRowTextById(LC_BigList.getSelectedID());
		%hasDupes = CheckAllDuplicates(%addName);
		if(%hasDupes == 0)
			LC_CCList.addRow(LC_CCList.RowCount()+1, %addName);
	}
	else
	{
		%selRow = LC_CCList.getRownumByID(LC_CCList.GetSelectedID());
		LC_CCList.removeRowbyID(LC_CCList.getSelectedID());
		if(%selRow>=LC_CCList.RowCount())
			%selRow = LC_CCList.RowCount()-1;
		LC_CCList.setSelectedRow(%selRow);
	}
	%this.DestList = 1;
}

// replacing function in webemail.cs, 797
function AddressDlg::AddTo(%this)
{
	if(LC_ToListBtn.direction == 0)
	{
		%addName = LC_BigList.getRowTextById(LC_BigList.getSelectedID());
		%hasDupes = CheckAllDuplicates(%addName);
		if(%hasDupes == 0 )
			LC_ToList.addRow(LC_ToList.RowCount()+1, %addName);
	}
	else
	{
		%selRow = LC_ToList.getRownumByID(LC_ToList.GetSelectedID());
		LC_ToList.removeRowbyID(LC_ToList.getSelectedID());
		if(%selRow>=LC_ToList.RowCount())
			%selRow = LC_ToList.RowCount()-1;
		LC_ToList.SetSelectedRow(%selRow);
	}
	%this.DestList = 0;
}

// replacing function in webemail.cs, 863
function AddressDlg::OK(%this)
{
	EMail_ToEdit.backing = ListToStr(LC_ToList,"\t");
	EMail_CCEdit.backing = ListToStr(LC_CCList,"\t");

	wzClans_mailui_recipientValidate();

	LC_BigList.Clear();
	Canvas.PopDialog("AddressDlg");
}

// replacing function in webemail.cs, 602
function ListToStr(%listName,%delim)
{
	%str = "";
	%rCount = %listName.rowCount();
	if (%rCount > 0)
	{
		for(%r=0;%r<%rCount;%r++)
		{
			%str = %str @ %listName.getRowText(%r);
			if(%r < %rCount-1)
			{
				%str = %str @ %delim;
			}
		}
	}
	return %str;
}

function wzClans_mailui_populateRList(%list, %backing)
{
	%entries = getFieldCount(%backing);
	%showList = "";
	for (%i = 0; %i < %entries; %i += 4)
	{
		%name = getField(%backing, %i);
		%tag = getField(%backing, %i + 1);
		%append = getField(%backing, %i + 2);
		%guid = getField(%backing, %i + 3);

		%list.addRow(%guid, %name TAB %tag TAB %append TAB %guid);
	}
}

// replacing function in webemail.cs, 953
function AddressDlg::onWake(%this)
{
	%this.doRefresh = 0;
	%this.key = LaunchGui.key++;
	%this.state = "loadlistbox";
	%this.lbstate = "errorcheck";
	%this.DestList = 0;
	%this.SrcList = 0;
	LC_BuddyListBtn.setVisible(0);
	LC_ListBox.Clear();
	LC_ListBox.Add("Select List",0);
	LC_ListBox.Add("Buddy List",1);
	LC_ListBox.setSelected(0);
	LC_Search.clear();

	//StrToList(LC_ToList,Email_ToEdit.getValue(),",");
	LC_ToList.clear();
	wzClans_mailui_populateRList(LC_ToList, EMail_ToEdit.backing);
	//StrToList(LC_CCList,Email_CCEdit.getValue(),",");
	LC_CCList.clear();
	wzClans_mailui_populateRList(LC_CcList, EMail_CCEdit.backing);

	// retrieve a list of clans the user is in
	// and make the list of members available for easy emailing.
	%myguid = getField(WONGetAuthInfo(), 3);
	%player = wzClans_browser_getPlayerProfile(%myguid);

	%mcount = %player.mcount;
	if (%mcount !$= "")
	{
		%ptag = getField(%player.tag, 0);
		for (%i = 0; %i <= %mcount; %i++)
		{
			%membership = %player.membership[%i];
			%mid = getField(%membership, 0);
			%mname = getField(%membership, 1);

			LC_ListBox.add(%mname, %mid);
		}
	}
}

function wzClans_mailui_selectedBox(%box)
{
	switch (%box)
	{
		case 0: // wired to inbox button
			$WZClans::Community::MailUI::ActiveMailbox = "inbox";
			wzClans_mailui_clearCheckStatus();
			wzClans_mailui_displayBox("inbox");
		case 1: // wired to deleted items button
			$WZClans::Community::MailUI::ActiveMailbox = "deleted";
			wzClans_mailui_clearCheckStatus();
			wzClans_mailui_displayBox("deleted");
		case 2: // newly wired to sent items button which was present, but hidden
			$WZClans::Community::MailUI::ActiveMailbox = "sentbox";
			wzClans_mailui_clearCheckStatus();
			wzClans_mailui_displayBox("sentbox");
	}
}

package wzClans_tmail
{
	function EmailGui::onWake(%this)
	{
		Parent::onWake(%this);

		// Make these buttons inactive until a message is selected:
		EM_ReplyBtn.setActive( false );
		EM_ReplyToAllBtn.setActive( false );
		EM_ForwardBtn.setActive( false );
		EM_DeleteBtn.setActive( false );
		EM_BlockBtn.setActive( false );
		%selId = EM_Browser.getSelectedId();
		Canvas.pushDialog(LaunchToolbarDlg);
		
		// DarkDragonDX: The mailUI override for selected buttons didn't work
		rbInbox.command = "wzClans_mailui_selectedBox(0);";
		rbSendItems.command = "wzClans_mailui_selectedBox(2);";
		rbDeleted.command = "wzClans_mailui_selectedBox(1);";

		if ( EM_Browser.rowCount() > 0 )
		{
			%row = EM_Browser.findById( %selId );
			if ( %row == -1 )
				EM_Browser.setSelectedRow( 0 );
			else
				EM_Browser.setSelectedRow( %row );
		}

		//error("EmailGui::onWake: " @ %this);
		$WZClans::Community::MailUI::Awake = 1;
		wzClans_mailui_loadSelected();
	}

	function EmailGui::onSleep(%this)
	{
		Parent::onSleep(%this);
		$WZClans::Community::MailUI::Awake = 0;
		//error("EmailGui::onSleep: " @ %this);
	}
		
	// DarkDragonDX: Overwrite this function for the "GET MAIL" Button
	function GetEmailBtnClick()
	{
		// We request the TMail and when the request completes, the callback
		// wzClans_mail_requestCompleted is executed.
		wzClans_mail_request_getNew($WZClans::Community::MailUI::ActiveMailbox);
	}
	
	function wzClans_mail_requestCompleted()
	{
		parent::wzClans_mail_requestCompleted();
		
		// Add a small delay to make sure we have everything
		schedule(200,0,"wzClans_mailui_displayBox", $WZClans::Community::MailUI::ActiveMailbox);
	}
	
	function GuiMLTextCtrl::onURL(%this, %url)
	{
		%payload = strReplace(%url, "-", " ");
		%command = getWord(%payload, 0);
		%identifier = getWord(%payload, 1);

		switch$(%command)
		{
			case "acceptinvite": 
			wzClans_browser_user_acceptInvite(%identifier);
			EmailMessageDelete(); // This code shouldn't be executed unless we clicked on accept/reject in an invitations
			messageBoxOK("ACCEPTED", "You have accepted the clan invitation.");
			
			case "rejectinvite": 
			wzClans_browser_user_rejectInvite(%identifier); 
			EmailMessageDelete();
			messageBoxOK("DECLINED", "You have rejected the clan invitation.");

			default: // Pass it on to anything else interested
			parent::onURL(%this, %url);
		}
	}
};
if (!isActivePackage(wzClans_tmail))
	activatePackage(wzClans_tmail);
	
