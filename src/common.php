<?php

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
		<option value="template"></option>
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