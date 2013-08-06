<?php

include("src/common.php");

$title = "Client using HTML5 websockets API to a chat server";
$path = __DIR__;

$html = "<div id='flash'><h1>Setting up a client for a websocket chat server.</h1>";
$html .= getHelpText($helpText);
$html .= createChatUI();
$html .= "</div>";

include($path . "/incl/header.php");
echo $html;
include($path . "/incl/footer.php");
