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

Messages are recieved as JSON, containing:
window:
msg:
Server responds with a JSON object that contains:
type:
data:{}

The different times that the clients needs to handle are:
action
	Actions are /me-actions printed in specific window
error
	Error messages are always printed to current window
message
	Simple text message to specific window
notice
	Message from server always printed to status/log
private
	Private text message to private window
status
	Server response, often user status change, or topics, to specific
toggle
	Toggles a window: opens or closes a channel
topic
	Sets a window topic, printed in #hTopic
update
	Updates a name of a private window (on namechange)
users
	Updates userlist of a channel


The protocol is run in the function acceptConnectionAsChat(request).

On first message sent, a username is set
All messages after that are handled as either text or commands
Commands are all text message that start with "/"
Commands are then handled in a switch case
	Arguments are split by word from the message
	Command-function is then run from COMM
		COMM-functions handle the logic of the command and create a response
		COMM-functions then call on either User och Channel where the response
		is sent
Simple messages are broadcasted to a channel or sent to a target user (priv)

COMM {}
	Contains functions for all commands, descriptions of commands, helpfunctions
	and nick and message limits

Channel object prototype
	Each channel has it's own object which contains:
	ops[]
	bans[]
	users[]
	topic{}
	created{}
	
	The prototype contains channelspecific functions for all channels:
	// getters
	createUserlist: function()
	getBanlist: function()
	getCreated: function()
	getNames: function()
	getTopic: function()
	getTopicText: function()
	// setters
	addBan: function(user)
	addOp: function(user)
	addUser: function(user)
	removeBan: function(user)
	removeOp: function(user)
	removeUser: function(user)
	setTopic: function(text, user)
	switchName: function(oldNick, newNick)
	// checks
	inChannel: function(user)
	isBanned: function(user)
	isOp: function(user)
	isOwner: function(user)
	broadcastMsg: function(json)
	
User object prototype
	Each connection user is saved as an object which contains:
	id
	activeChannels[]
	privs[]
	
	The prototype contains userspecific functions and variables for all users:
	// variables
	idleTimer: 1000,
	// getters
	getChannels: function()
	getInfo: function(nick)
	getPrivs: function()
	// setters
	addChannel: function(channel)
	addPriv: function(nick)
	leaveChannel: function(channel)
	// checks
	isInChannel: function(channel)
	isInPriv: function(nick
	// other
	sendMsg: function(json)
	
Channelobjects are found in channelList{} by name, and userobjects are found in 
userList{} by name
Client websocket info is stored in connectedClients[]

