/**
 * Create a stripped websocket-server using the sample code from:
 * https://github.com/Worlize/WebSocket-Node#server-example
 * 
 */
var port = 57005;
var connectedClients = [];
var userList = {};
var channelList = {};

var COMM = {
	max_nick: 12,
	max_msg: 256
};

// Require the modules we need
var WebSocketServer = require("websocket").server;
var http = require("http");

/**
 * Create a http server with a callback for each request
 * 
 */
var httpServer = http.createServer(function(request, response) {
	console.log((new Date()) + " Received request for " + request.url);
	response.writeHead(200, {
		"Content-type": "text/plain"
	});
	response.end("Hello world\n");
}).listen(port, function() {
	console.log((new Date()) + " HTTP server is listening on port " + port);
});

/**
 * Create an object for the websocket
 * https://github.com/Worlize/WebSocket-Node/wiki/Documentation
 */
wsServer = new WebSocketServer({
	httpServer: httpServer,
	autoAcceptConnections: false
});

/**
 * Always check and explicitly allow the origin
 *
 */
function originIsAllowed(origin) {
	if(origin === "http://www.student.bth.se" || origin === "http://localhost") {
		return true;    
	}
	return false;
}

/**
 * Check if the user is online (among userList)
 *
 */
function isNickUsed(nick) {
	var valid = true;
	if(userList[nick] === undefined) {
		valid = false;
	}
	return valid;
}

function rand(min, max) {
	return Math.floor((Math.random()*max)+min);
}

function removeUserFromChannels(user, userName) {
	for(var i in user.activeChannels) {
		var channel = user.activeChannels[i];
		var index = channelList[channel].users.indexOf(userName);
		channelList[channel].users.splice(index, 1);
		// update others userlists?
		var json = createJSON(channelList[channel].users, "Server", "users", channel);
		broadcastMsg(json, channel);
		var out = userName + " has quit";
		json = createJSON(out, "Server", "status", channel);
		broadcastMsg(json, channel);
	}
}

// -----------------------------------------------------------------------------
// COMMANDS
// -----------------------------------------------------------------------------
COMM.isComm = function(msg) {
	var valid = false;
	if(msg.substr(0, 1) === "/" && msg.length > 1) {
		valid = true;
	}
	return valid;
}

/**
 *	HELP
 */
COMM.help = function(id, command) {
	var out, json, type;
	if(!command) {
		// view all commands
		out = "help&#09;msg&#09;me&#09;nick&#09;join";
		type = "notice";
	} else {
		// view for one command
		// check that it was a valid command
		if(COMM[command] === undefined) {
			// error
			out = "Command " + command + " was not a valid argument. Check the list of avaiable commands again.";
			type = "error";
		} else {
			console.log(COMM.help.desc);
			out = COMM[command].desc;
			type = "notice";
		}
	}
	// turn into json (msg, sender)
	json = createJSON(out, "Server", type, false);
	// sends back to user it came from
	connectedClients[id].sendUTF(json);
}
COMM.help.desc = "/help (command)<br/>"
+ "<br/>" + "Lists avaiable commands, and shows help on commands"
+ "<br/>" + "/help will print all commands."
+ "<br/>" + "Example: /help <command> will print help for that command."
+ "<br/>" + "Syntax: () - optional argument<br/>[] - needed argument";

/**
 *	MSG
 */
COMM.msg = function(id, sender, nick, msg) {
	var out = "", json, type;
	// check that nick was valid
	if(nick === undefined) {
		out = "You must enter a nickname to send to.";
		type = "error";
		sender = "Server";
		nick = false;
	} else if (!isNickUsed(nick)) {
		out = "User " + nick + " is not online.";
		type = "error";
		sender = "Server";
		nick = false;
	} else if(msg.replace(/\s/g, "").length === 0){
		// check that message is not empty
		// string is invalid
		out = "Message missing.";
		type = "error";
		sender = "Server";
		nick = false;
	} else {
		out = msg;
		type = "private";
	}
	// create msg (time, msg, sender: to/from, new?)
	json = createJSON(out, sender, type, nick);
	// sends to user it came from and to user with nick
	// to user it came from: sender: sender, channel: nick
	connectedClients[id].sendUTF(json);
	if(type === "private") {
		// to user it is going to: sender: sender, channel: sender
		json = createJSON(out, sender, type, sender);
		connectedClients[userList[nick].id].sendUTF(json);
	}
}
COMM.msg.desc = "/msg [nick] [message]<br/>"
+ "<br/>" + "Send a private message to another user"
+ "<br/>" + "Example: /msg Charlie Hi, how are you?";

/**
 *	ME
 */
COMM.me = function(sender, channel, msg) {
	var out, json, type;
	// msg type? notice? maybe?
	type = "action";
	out = sender + " " + msg;
	// broadcast to channel
	json = createJSON(out, "Server", type, channel);
	broadcastMsg(json, channel);
}
COMM.me.desc = "/me (action-text)<br/>"
+ "<br/>" + "Prints an action-type text into the active channel"
+ "<br/>" + "Example: '/me is cool' prints as '* [You] is cool' where [You] is your nickname.";

/**
 *	NICK
 */
COMM.nick = function(id, oldNick, newNick) {
	var out, type, json, nick, user, i, index;
	// check that newNick doesn't already exist
	if(isNickUsed(newNick)) {
		// someone else is already called that
		out = "Nick " + newNick + " is already in use";
		type = "error";
		nick = oldNick;
	} else if(newNick === oldNick) {
		// check that newNick != oldNick
		out = "You're nick already is " + oldNick;
		type = "error";
		nick = oldNick;
	} else {
		type = "status";
		// trim nicklength
		if(newNick.length > COMM.max_nick) {
			newNick = newNick.slice(0, COMM.max_nick);
		}
		// set newNick in userlist
		nick = newNick;
		user = userList[oldNick];
		delete userList[oldNick];
		userList[newNick] = user;
		// set newNick in all the channels lists from activeChannel
		out = "is now known as " + newNick;
		for(i=0; i<user.activeChannels.length; i++) {
			index = channelList[user.activeChannels[i]].users.indexOf(oldNick);
			channelList[user.activeChannels[i]].users[index] = newNick;
			// send nickchange to each channel
			json = createJSON(out, oldNick, type, user.activeChannels[i])
			broadcastMsg(json, user.activeChannels[i]);
		}
		// send as notice to user
		out = "You are now known as " + newNick;
		json = createJSON(out, "Server", "notice", false);
		connectedClients[id].sendUTF(json);
	}
	// return nick set to server
	return nick;
}
COMM.nick.desc = "/nick [newNick]<br/>"
+ "<br/>" + "Used to change your visible nickname";

COMM.ignore = function(id, user, nick) {
	var out, type, json;
	// is nick a online user?
	if(!isNickUsed(nick)) {
		// if not send error
		type = "error";
		out = "User " + nick + " was not found";
	} else {
		// if it is, add it to userList[user].ignores
		userList[user].ignores.push(nick);
		out = "User " + nick + " now ignored";
		type = "notice";
	}
	json = createJSON(out, "Server", type, false);
	connectedClients[id].sendUTF(json);
}
COMM.ignore.desc = "/ignore [username]<br/>"
+ "<br/>" + "Used to filter out anything send from this user";

COMM.unignore = function(user, nick) {
	
	}
COMM.unignore.desc = "";

COMM.whois = function() {
	
	}
COMM.whois.desc = "";

COMM.slap = function() {
	
	}
COMM.slap.desc = "";

COMM.list = function() {
	
	}
COMM.list.desc = "";

COMM.names = function() {
	
	}
COMM.names.desc = "";

COMM.join = function(user, channel) {
	var out, type, json;
	// does channel exist?
	if(channel !== undefined && channel !== "" ) {
		// does channel exist?
		if(channelList[channel] === undefined) {
			channelList[channel] = new Channel(user);
		}
		// is user already in that channel?
		if(userList[user].activeChannels.indexOf(channel) === -1) {
			// tell client to open window
			json = JSON.stringify({
				type: "toggle",
				name: channel
			});
			connectedClients[userList[user].id].sendUTF(json);
			
			// add user
			channelList[channel].users.push(user);
			userList[user].activeChannels.push(channel);			
			
			// send topic and channel creation info back to user
			// creation time
			var time = new Date(channelList[channel].created.time);
			out = "Channel was created by " + channelList[channel].created.who + " at " + time.toUTCString();
			type = "status";
			json = createJSON(out, "Server", type, channel);
			connectedClients[userList[user].id].sendUTF(json);
			// topic, if set
			if(channelList[channel].topic !== false) {
				type = "topic";
				json = createJSON(channelList[channel].topic, "Server", type, channel);
				connectedClients[userList[user].id].sendUTF(json);
			}
			// send userlist back to user
			type = "users";
			json = createJSON(channelList[channel].users, "Server", type, channel)
			broadcastMsg(json, channel);
		
			// send msg that user connected to all other users in channel
			type = "status";
			out = user + " joined #" + channel;
			json = createJSON(out, "Server", type, channel);
			broadcastMsg(json, channel);
		} else {
			out = "You're already in " + channel;
			type = "error";
			json = createJSON(out, "Server", type, channel);
			connectedClients[userList[user].id].sendUTF(json);
		}
	}
}
COMM.join.desc = "/join (#)[channel]<br/>"
+ "<br/>" + "Used to join channels"
+ "<br/>" + "Will create new channel if none with that name exists"
+ "<br/>" + "# is optional, ie /join qwe and /join #qwe will make you join same channel";

COMM.part = function(userName, channel) {
	
	}
COMM.part.desc = "/part<br/>"
+ "<br/>" + "Used to leave channels"
+ "<br/>" + "Needs to be written in the channel window of which you want to leave";

COMM.leave = function() {
	
	}
COMM.leave.desc = "";

COMM.topic = function() {
	
	}
COMM.topic.desc = "";

COMM.op = function() {
	
	}
COMM.op.desc = "";

COMM.voice = function() {
	
	}
COMM.voice.desc = "";

COMM.kick = function() {
	
	}
COMM.kick.desc = "";

COMM.ban = function() {
	
	}
COMM.ban.desc = "";

COMM.quit = function() {
	
	}
COMM.quit.desc = "";

// -----------------------------------------------------------------------------
// CHANNEL as object
// -----------------------------------------------------------------------------
function Channel(user) {
	this.ops	=	[],
	this.voice	=	[],
	this.bans	=	[],
	this.users	=	[],
	this.topic	=	false,
	this.created =	{
		who: user,
		time: (new Date()).getTime()
	}
}

Channel.prototype = {
	setTopic: function(text, user) {
		this.topic = {
			topicText: text,
			who: user,
			time: (new Date()).getTime()
		}
	}
}

// -----------------------------------------------------------------------------
// USER as object
// -----------------------------------------------------------------------------

function User(connection) {
	this.id	= connection.broadcastId;
	this.activeChannels	= [],
	this.ignores = []
}

User.prototype = {

	}

// -----------------------------------------------------------------------------
// CHAT
// -----------------------------------------------------------------------------
function acceptConnectionAsChat(request) {
	var userName = false;
	var connection = request.accept("chat-protocol", request.origin);
	connection.broadcastId = connectedClients.push(connection) - 1;
	console.log((new Date()) + " Chat connection accepted from " + request.origin + " id = " + connection.broadcastId);

	// Callback to handle each message from the client
	connection.on("message", function(message) {
		var time = new Date(),
		out, json, msg, clientMsg, channel, nick;
		
		clientMsg = JSON.parse(message.utf8Data);
		
		console.log(clientMsg);
		
		if(userName === false) {
			nick = htmlEntities(clientMsg.msg);
			// only take first word
			nick = nick.split(" ")[0];
			// max length: 12
			if(nick.length > COMM.max_nick) {
				nick = nick.slice(0, COMM.max_nick);
			}
			
			while(isNickUsed(nick)) {
				out = "Nick " + nick + " is already in use. ";
				nick += rand(0, 9);
			}
			userName = nick;
			
			out = "Your are known as " + nick;
			json = createJSON(out, "Server", "notice", false);
			connectedClients[connection.broadcastId].sendUTF(json);
			
			console.log(time + " User is known as: " + userName);
			// add to userlist
			userList[userName] = new User(connection);
		} else {
			channel = clientMsg.window;
			msg = htmlEntities(clientMsg.msg);
			// what type of msg? text or command?
			// if first char is "/" = command
			if(msg.substr(0, 1) === "/" || channel === "log") {
				console.log(time + " Recieved command from " + userName + ": " + msg);
				// split message, get first word
				var command = msg.split(" ")[0];
				var args;
				command = msg.slice(1, command.length);
				switch(command) {
					case("help"):
						// does it have arguments?
						args = msg.split(" ");
						var whatComm = (args[1] !== undefined) ? args[1] : false;
						COMM.help(connection.broadcastId, whatComm);
						break;
					case("me"):
						// is in channel?
						if(userList[userName].activeChannels.length !== 0) {
							args = msg.split(" ");
							args.shift(); // remove command
							var action = args.join(" ");
							COMM.me(userName, channel, action);
						}
						break;
					case("msg"):
						args = msg.split(" ");
						args.shift(); // remove command
						nick = args.shift();
						msg = args.join(" ");
						COMM.msg(connection.broadcastId, userName, nick, msg)
						break;
					case("nick"):
						args = msg.split(" ");
						args.shift();
						nick = args.shift();
						userName = COMM.nick(connection.broadcastId, userName, nick);
						break;
					case("join"):
						args = msg.split(" ");
						args.shift();
						channel = args.shift();
						channel = channel.replace("#", "");
						COMM.join(userName, channel);
						break;
					case("slap"):
						break;
					case("names"):
						break;
					case("ignore"):
						break;
					default:
						// send message that command does not exist
						message = "Unknown command: " + msg;
						json = createJSON(message, "Server", "notice", false);
						connectedClients[connection.broadcastId].sendUTF(json);
						break;
				}
			} else {
				console.log(time + " Recieved message from " + userName + ": " + msg);
			
				// public message, do broadcast
				json = createJSON(msg, userName, "message", channel);
				broadcastMsg(json, channel);
			}
		}
	});
  
	// Callback when client closes the connection
	connection.on("close", function(reasonCode, description) {
		var time, message, obj, json, i;
		time = new Date();
		console.log(time + " Peer " + connection.remoteAddress + " disconnected broadcastid = " + connection.broadcastId + ".");
		message = "User " +  userName + " disconnected";
		json = createJSON(message, "Server", "message");
		removeUserFromChannels(userList[userName], userName);
		delete userList[userName];
		connectedClients[connection.broadcastId] = null;
	//		broadcastMsg(json);
	});

	return true;
}

/**
 *	Create the JSON-objects that will be sent to the user
 */
function createJSON(message, sender, msgType, toChannel) {
	var time = new Date();
	var obj = {
		time: time.getTime(),
		text: htmlEntities(message),
		author: sender,
		channel: toChannel
	}
	var json = JSON.stringify({
		type: msgType,
		data: obj
	});
	console.log(json);
	return json;
}

/**
 *	Broadcast JSON to clients
 */
function broadcastMsg(json, channel) {
	var i, users, user;
	users = channelList[channel].users;
	for(i in users) {
		user = userList[users[i]];
		connectedClients[user.id].sendUTF(json);
	}
}

/**
 * Create a callback to handle each connection request
 *
 */
wsServer.on("request", function(request) {
	var status = null;

	if (!originIsAllowed(request.origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		console.log((new Date()) + " Connection from origin " + request.origin + " rejected.");
		return;
	}

	// Loop through protocols. Accept by highest order first.
	for (var i=0; i < request.requestedProtocols.length; i++) {
		if(request.requestedProtocols[i] === "chat-protocol") {
			status = acceptConnectionAsChat(request);
		}
	}

	// Unsupported protocol.
	if(!status) {
		console.log("Subprotocol not supported");
		request.reject(404, "Subprotocol not supported");
	}

});

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
/**
 * Avoid injections
 *
 */
function htmlEntities(str) {
	return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}