<?php

$helpText = <<<EOD
<p>For help with avaiable commands in chat, send <code>/help</code> when 
	connected. For help with a specific command send <code>/help [commandName]
	</code> when connected</p>
<p>Nicknames and channelnames may only contain letters and numbers.</p>
<p>Send a message by typing in the message field and press enter or the button 
	<code>Send message</code></p>
<p>You can send a private message to another user by either doubleclicking 
	their names in the userlist and sending a message or using the <code>/msg
	</code> command. Type <code>/help msg</code> to see how to use it.</p>
<p>New activity in a window that is not active is shown by a hilight, a change 
	in color on the name of the window in the channellist.</p>
EOD;

function createChatUI() {
	$html = "<div id='chat'>";
	
	$html .= getConnectForm();
	$html .= getChatWindow();
	
	$html .= "</div>";
	return $html;
}

function getList($id, $float) {
	$html = <<<EOD
<div class="sidebar {$float}">
	<header>{$id}</header>
	<select size="18" name="{$id}" id="{$id}">
		<option value="template" class="template">empty</option>
	</select>
</div>
EOD;
	
	return $html;
}

function getChannelWindow() {
	$html .= <<<EOD
<div id='channelWindow'>
	<header id='channelStatus'>
		<span id='hChannel'></span>
		<span id='hTopic'></span>
	</header>
	<div id='log'></div>
	<p>
		<input id="message"/>
		<input id="send_message" type="button" value="Send message"/>
	</p>
</div>
EOD;

	return $html;
}

function getChatWindow() {
	$html = "<div id='chatWindow'>";
	
	$html .= "<input id='close' type='button' value='Close connection'/>";
	$html .= getList("channelList", "left");
	$html .= getList("userList", "right");
	$html .= getChannelWindow();
	
	$html .= "</div>";
	return $html;
}

function getConnectForm() {
	$html = <<<EOD
<form id="connectForm">
	<p>
		<label>Connect: </label><br/><input id="connect_url"/>
	</p>
	<p>
		<label>Nick: </label><br/><input id="nick"/>
	</p>
	<p>
		<input id="connect" type="button" value="Connect"/>
	</p>
	<p id="status"></p>
</form>
EOD;
	
	return $html;
}

function getHelpText($text) {
	$html = <<<EOD
<img src="css/helpicon.png" width=19 height=23 id="hicon" alt="help icon" />
<div id="help">
	$text
</div>
EOD;
	return $html;
}