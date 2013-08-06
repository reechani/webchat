--------------------------------------------------------------------------------
PROJECT FOR COURSE DV1441 - Javascript, jQuery och AJAX med HTML5 och PHP
BY Jane Strandberg
	jast10
--------------------------------------------------------------------------------
Assignment:
	Create a server/client chat
	Tools:
		JS, jQuery, JSON, node.js (with websockets)
		PHP
		HTML5, CSS3
	Desc:
		Make a simple chatclient, similar to those found online today
--------------------------------------------------------------------------------
INSTALLATION

This installation describes how to setup to a linux system.

This application consists of 2 parts: the server and the client.
The server is one single file: chatserver.js and the client is made up of the 
rest of the files.

The client should be installed to your webserver catalogue, so that the site 
becomes available through a browser.
The client is then run through index.php, and is run via HTML5, CSS3, PHP and JS,
so make sure that your webserver has PHP-support.

For the server, you need to install node.js and the module WebSocket.
Node.js website: http://nodejs.org/
Installguide: https://github.com/joyent/node/wiki/Installation

Once you have node.js installed you should have the npm command aswell, and 
can just:
$npm install websocket
Websocket module: https://github.com/Worlize/WebSocket-Node

To run the webserver, run it with node:
$node chatserver.js

The chatserver should now be available at ws://yourhost:yourport
See below for configuration of the server and client

--------------------------------------------------------------------------------
CONFIGURATION

SERVER:
The server needs an open port to send and receive messages. To set this port in 
the server, you need to set it as a variable.
Open chatserver.js in any editor. On line 6, change the port
variable to the port number you choose to run it from. Observe that this port,
if not already allowed in the firewall, needs to be configured.
The variable port is the one used to listen on the socket, and is also the one 
the client is going to connect to.

There is also a function to limit where the client can connect from, the origin
of the connection.
In chatserver.js, find the originIsAllowed-function, in the SERVER aid-functions
section (line 51). Here, set the origins allowed. It should look something like 
this:
function originIsAllowed(origin) {
	if(origin === "http://yourwebsite.com") {
		return true;
	}
	return false;
}

Other configurations that you can change are the allowed lenght of nicknames and
messages sent to the server. The initial variable in COMM (line 12) can be 
changed to what you see fit. The default here is 12 chars for nicknames, and 256
for messages.

CLIENT:
The client can be run as it is, but for usability reasons, you should set the 
default url to that of your chatserver websocket. This url consists of protocol,
website adress, and portnumber: ws://yourwebsite.com:port
The portnumber set should of course be the one that you run your server on.

To configure appearance and other behaviour you should have prior knowledge of 
HTML5, CSS3, PHP and JS/jQuery. That said, the rest is really up to you. But be 
sure to keep the handling of the received messages intact.

--------------------------------------------------------------------------------
DOCUMENTATION

With the files come two images: connectoverview.png and chatoverview.png where 
you can see some of the essential classes and ID's used to create and run the 
client.

SERVER
