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

/**
 * Randomization function for set interval
 * 
 */
function rand(min, max) {
	return Math.floor((Math.random()*max)+min);
}

/**
 *	Clears user from all channel listings, used on quit/disconnect
 *	
 */
function clearUserFromAllChannels(user, userName) {
	var i, json, out, channels = user.getChannels();
	for(i in channels) {
		if(user.leaveChannel(channels[i])) {
			var channel = channelList[channels[i]];
			if(channel.removeUser(userName)) {
				// send userlist
				json = createJSON(channel.createUserlist(), "Server", "users", channels[i])
				channel.broadcastMsg(json);
				
				// to channel
				out = userName + " has quit";
				json = createJSON(out, "Server", "status", channels[i]);
				channel.broadcastMsg(json);
			}
		}
	}
}

//function removeUserFromChannel(userName, channel) {
//	var users = channelList[channel].users;
//	var index = users.indexOf(userName);
//	users.splice(index, 1);
//	var channels = userList[userName].activeChannels;
//	index = channels.indexOf(channel);
//	channels.splice(index, 1);
//	var json = createJSON(users, "Server", "users", channel);
//	broadcastMsg(json, channel);
//	return userName + " has left";
//}

/**
 *	Create a userlist for client with ops marked
 *	TODO: move to channel prototype
 */
//function createUserlist(channel) {
//	var i,
//	index,
//	users = channelList[channel].users,
//	ops = channelList[channel].ops,
//	regular = [],
//	opUsers = [],
//	clientUserlist = [];
//	for(i in users) {
//		index = ops.indexOf(users[i]);
//		if(index > -1) {
//			opUsers.push("@" + users[i]);
//		} else {
//			regular.push(users[i]);
//		}
//	}
//	clientUserlist = opUsers.concat(regular);
//	return clientUserlist;
//	
//}

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
 *	-> TODO
 */
COMM.help = function(sender, command) {
	var out, json, type, user = userList[sender];
	if(!command) {
		// view all commands
		/*	
		 *	TODO:
		 *	Find better way of listing commands available
		 */
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
			//			console.log(COMM.help.desc);
			out = COMM[command].desc;
			type = "notice";
		}
	}
	// turn into json (msg, sender)
	json = createJSON(out, "Server", type, false);
	// sends back to user it came from
	user.sendMsg(json);
}
COMM.help.desc = "/help (command)<br/>"
+ "<br/>" + "Lists avaiable commands, and shows help on commands"
+ "<br/>" + "/help will print all commands."
+ "<br/>" + "Example: /help <command> will print help for that command."
+ "<br/>" + "Syntax: () - optional argument<br/>[] - needed argument";

/**
 *	MSG
 */
COMM.msg = function(sender, nick, msg) {
	var out, json, type, user = userList[sender], target = userList[nick];
	// check that nick was valid
	if(nick === undefined) {
		out = "You must enter a nickname to send to.";
		type = "error";
	} else if (!isNickUsed(nick)) {
		out = "User " + nick + " is not online.";
		type = "error";
	} else if(msg.replace(/\s/g, "").length === 0){
		// check that message is not empty
		// string is invalid
		out = "Message missing.";
		type = "error";
	} else {
		out = msg;
		type = "private";
	}
	switch(type) {
		case("error"):
			json = createJSON(out, "Server", type, false);
			break;
		case("private"):
			json = createJSON(out, sender, type, sender);
			target.sendMsg(json);
			json = createJSON(out, sender, type, nick);
			break;
	}
	//	// create msg (time, msg, sender: to/from, new?)
	//	json = createJSON(out, sender, type, nick);
	//	// sends to user it came from and to user with nick
	//	// to user it came from: sender: sender, channel: nick
	user.sendMsg(json);
//	if(type === "private") {
//		// to user it is going to: sender: sender, channel: sender
//		json = createJSON(out, sender, type, sender);
//		target.sendMsg(json);
//	}
}
COMM.msg.desc = "/msg [nick] [message]<br/>"
+ "<br/>" + "Send a private message to another user"
+ "<br/>" + "Example: /msg Charlie Hi, how are you?";

/**
 *	ME
 */
COMM.me = function(sender, channelName, msg) {
	var out, json, type, user = userList[sender], channel = channelList[channelName];
	//	if (channelName == "log") {
	//		type = "error";
	//		out = "Must write command in channel window";
	//	} else {
	//		type = "action";
	//		out = sender + " " + msg;
	//	}
	if(channel !== undefined) {
		out = sender + " " + msg;
		type = "action";
	} else {
		type = "error";
		out = "Must write command in channel window";
	}

	json = createJSON(out, "Server", type, channel);
	if(type == "error") {
		user.sendMsg(json);
	//		connectedClients[userList[sender].id].sendUTF(json);
	} else {
		// broadcast to channel
		channel.sendMsg(json);
	//		broadcastMsg(json, channel);
	}
}
COMM.me.desc = "/me (action-text)<br/>"
+ "<br/>" + "Prints an action-type text into the active channel"
+ "<br/>" + "Example: '/me is cool' prints as '* [You] is cool' where [You] is your nickname.";

/**
 *	NICK
 */
COMM.nick = function(sender, newNick) {
	var out, type, json, nick, user = userList[sender], i;
	// check that newNick doesn't already exist
	if(newNick === sender) {
		// check that newNick != oldNick
		out = "You're nick already is " + sender;
		type = "error";
	//		nick = oldNick;
	} else if(isNickUsed(newNick)) {
		// someone else is already called that
		out = "Nick " + newNick + " is already in use";
		type = "error";
	//		nick = oldNick;
	} else if(newNick === undefined || newNick === "") {
		type = "error";
		out = "Nick can not be empty";
	} else {
		type = "status";
		// trim nicklength
		if(newNick.length > COMM.max_nick) {
			newNick = newNick.slice(0, COMM.max_nick);
		}
	}
	switch(type) {
		case("error"):
			nick = sender;
			break;
		case("status"):
			// set newNick in userlist
			nick = newNick;
			delete userList[sender];
			userList[nick] = user;
			// set newNick in all the channels lists from activeChannel
			var channels = user.getChannels();
			out = sender + " is now known as " + nick;
			for(i in channels) {
				var channel = channelList[channels[i]];
				// change nickname in channel
				channel.switchName(sender, nick);
				// send userlist to channel
				json = createJSON(channel.createUserlist(), "Server", "users", channels[i]);
				channel.broadcastMsg(json);
				// send message of nickchange to channel
				json = createJSON(out, sender, type, channels[i]);
				channel.broadcastMsg(json);
			}
			//			for(i=0; i<user.activeChannels.length; i++) {
			//				index = channelList[user.activeChannels[i]].users.indexOf(oldNick);
			//				channelList[user.activeChannels[i]].users[index] = newNick;
			//				// send nickchange to each channel
			//				out = sender + " is now known as " + newNick;
			//				json = createJSON(out, oldNick, type, user.activeChannels[i])
			//				broadcastMsg(json, user.activeChannels[i]);
			//							
			//				// send updated userlist
			//				type = "users";
			//				json = createJSON(channelList[user.activeChannels[i]].users, "Server", type, user.activeChannels[i]);
			//				broadcastMsg(json, user.activeChannels[i]);
			//				}
			// create msg for user
			out = "You are now known as " + newNick;
			break;
	}
	json = createJSON(out, "Server", "notice", false);
	user.sendMsg(json);
	// return nick set to server
	return nick;
}
COMM.nick.desc = "/nick [newNick]<br/>"
+ "<br/>" + "Used to change your visible nickname";

/**
 *	WHOIS
 */
COMM.whois = function(sender, nick) {
	var out, type, json, user = userList[sender], target = userList[nick];
	if(target !== undefined) {
		type = "notice";
		out = target.getInfo(nick);		
	} else {
		type = "error";
		out = "Nickname can not be empty";
	}
	//	out = nick + "@" + connectedClients[userList[nick].id].remoteAddress + "<br/>";
	//	out += "Channels: ";
	//	for(var i in userList[nick].activeChannels) {
	//		out += "#" + userList[nick].activeChannels[i] + " ";
	//	}
	//	out += "<br/>Idle: " + connectedClients[userList[nick].id].socket._idleStart;
	
	json = createJSON(out, "Server", type, false);
	user.sendMsg(json);
}
COMM.whois.desc = "/whois [username]<br/>"
+ "<br/>" + "Prints information about user";

/**
 *	SLAP
 *	-> EMPTY
 */
COMM.slap = function() {
	
	}
COMM.slap.desc = "";

/**
 *	LIST
 */
COMM.list = function(userName) {
	var out, type, json, user = userList[userName];
	// lists all channels
	// get all channels and make string to send
	out = "Active channels:<br/>";
	for(var channel in channelList) {
		out += "#" + channel + "<br/>";
	}
	type = "notice";
	json = createJSON(out, "Server", type, false);
	user.sendMsg(json);
}
COMM.list.desc = "/list <br/>"
+ "<br/>" + "Lists all currently active channels";

/**
 *	NAMES
 *	-> TODO:
 *		Only prints to channel, can't see if not in it
 */
COMM.names = function(userName, channelName) {
	var out, type, json, user = userList[userName], channel = channelList[channelName];
	
	if(channelName !== "log" && channel !== undefined) {
		out = channel.getNames();
		//		out = "Users currently in " + channel + ":<br/>";
		//	
		//		for(var user in channelList[channel].users) {
		//			out += "[" + channelList[channel].users[user] + "]";
		//		}
		type = "status";
	} else {
		type = "error";
		out = "Invalid channel, cannot list users for " + channelName;
	}
	
	json = createJSON(out, "Server", type, channelName);
	user.sendMsg(json);
}
COMM.names.desc = "/names (channel)<br/>"
+ "<br/>" + "Lists all users currently in channel";

/**
 *	JOIN
 */
COMM.join = function(userName, channelName) {
	var out, type, json, user = userList[userName], channel = channelList[channelName];
	// is string empty?
	if(channelName !== undefined && channelName !== "" ) {
		// does channel exist?
		if(channel === undefined) {
			channel = channelList[channelName] = new Channel(userName);
		}
		// check: user not in channel
		if(!user.isIn(channelName)) {
			//		if(userList[user].activeChannels.indexOf(channel) === -1) {
			// tell client to open window
			json = JSON.stringify({
				type: "toggle",
				name: channelName
			});
			//			connectedClients[userList[user].id].sendUTF(json);
			user.sendMsg(json);
			
			// add user
			channel.addUser(userName);
			//			channelList[channel].users.push(user);
			user.addChannel(channelName);
			//			userList[user].activeChannels.push(channel);
			
			// send topic and channel creation info back to user
			type = "status";
			json = createJSON(channel.getCreated(), "Server", type, channelName);
			user.sendMsg(json);
			// topic
			type = "topic";
			json = createJSON(channel.getTopic(), "Server", type, channelName);
			user.sendMsg(json);
			
			// send userlist back to user
			type = "users";
			json = createJSON(channel.createUserlist(), "Server", type, channelName)
			channel.broadcastMsg(json);
		
			// send msg that user connected to all other users in channel
			type = "status";
			out = userName + " joined #" + channelName;
			json = createJSON(out, "Server", type, channelName);
			channel.broadcastMsg(json);
		} else {
			out = "You're already in " + channelName;
			type = "error";
			json = createJSON(out, "Server", type, channelName);
			user.sendMsg(json);
		}
	}
}
COMM.join.desc = "/join (#)[channel]<br/>"
+ "<br/>" + "Used to join channels"
+ "<br/>" + "Will create new channel if none with that name exists"
+ "<br/>" + "# is optional, ie /join qwe and /join #qwe will make you join same channel";

/**
 *	PART
 */
COMM.part = function(userName, channelName) {
	var out, json, user = userList[userName], channel = channelList[channelName];
	// does channel exist?
	if(user.leaveChannel(channelName)) {
		if(channel.removeUser(userName)) {
			// send userlist
			json = createJSON(createUserlist(channelName), "Server", "users", channelName)
			channel.broadcastMsg(json);
			
			// to channel
			out = userName + " has left " + channelName;
			json = createJSON(out, "Server", "status", channelName);
			channel.broadcastMsg(json);
			
			// to user
			out = "You have left " + channelName;
			json = createJSON(out, "Server", "notice", channelName);
			user.sendMsg(json);
		} else {
			// was not in channel
			out = "You are not in that channel";
			json = createJSON(out, "Server", "error", channelName);
			user.sendMsg(json);
		}
	} else {
		// was not in channel
		out = "You are not in that channel";
		json = createJSON(out, "Server", "error", channelName);
		user.sendMsg(json);
	}
}
COMM.part.desc = "/part<br/>"
+ "<br/>" + "Used to leave channels"
+ "<br/>" + "Needs to be written in the channel window of which you want to leave";

/**
 *	LEAVE
 */
COMM.leave = function(userName, channelName) {
	COMM.part(userName, channelName);
//	var out, json,
//	user = userList[userName],
//	channel = channelList[channelName];
//	// user functions
//	if(user.leaveChannel(channelName)) {
//		if(channel.removeUser(userName)) {
//			// send userlist
//			json = createJSON(createUserlist(channelName), "Server", "users", channelName)
//			channel.broadcastMsg(json);
//			
//			// to channel
//			out = userName + " has left " + channelName;
//			json = createJSON(out, "Server", "status", channelName);
//			channel.broadcastMsg(json);
//			
//			// to user
//			out = "You have left " + channelName;
//			json = createJSON(out, "Server", "notice", channelName);
//			user.sendMsg(json);
//		} else {
//			// was not in channel
//			out = "You are not in that channel";
//			json = createJSON(out, "Server", "error", channelName);
//			user.sendMsg(json);
//		}
//	} else {
//		// was not in channel
//		out = "You are not in that channel";
//		json = createJSON(out, "Server", "error", channelName);
//		user.sendMsg(json);
//	}
}
COMM.leave.desc = "/leave<br/>"
+ "<br/>" + "Used to leave channels"
+ "<br/>" + "Needs to be written in the channel window of which you want to leave";

/**
 *	TOPIC
 */
COMM.topic = function(userName, channelName, topic) {
	var out, type, json, user = userList[userName], channel = channelList[channelName];
	// if topic is set, set topic, else just print it to user	
	if(topic !== undefined && topic !== "") {
		//is user op?
		if(channel.isOp(userName)) {
			// op
			channel.setTopic(topic, userName);
			out = userName + " set topic to: " + topic; // broadcast
			type = "status";
			json = createJSON(out, "Server", type, channel);
			channel.broadcastMsg(json);
			// send new topic text to inferface
			out = topic;
			type = "topic";
			json = createJSON(out, userName, type, channel);
			channel.broadcastMsg(json);
		} else {
			// not op
			// can't do that -  no permission
			out = "You don't have permission to change topic";
			type = "error";
			// unicast
			json = createJSON(out, "Server", type, channel);
			user.sendMsg(json);
		}
	} else {
		// print it to user
		out = channel.getTopic();
		if(out == "") {
			out = "Topic not set";
		}
		type = "status";
		json = createJSON(out, "Server", type, channel);
		user.sendMsg(json);
	}
}
COMM.topic.desc = "/topic (text)<br/>";

/**
 *	OP
 */
COMM.op = function(userName, channelName, userToOp) {
	var out, type, json,
	user = userList[userName], channel = channelList[channelName],
	target = userList[userToOp];
	// is username op?
	if(channel.isOp(userName)) {
		// user is op
		// is target in channel?
		if(channel.inChannel(userToOp)) {
			// is target already op?
			if(channel.isOp(userToOp)) {
				channel.addOp(userToOp);
				type = "status";
				out = userToOp + " has been oped by " + userName;
			} else {
				type = "error";
				out = "User is already op";
			}
		} else {
			type = "error";
			out = "User is not in channel";
		}
	} else {
		type = "error";
		out = "You don't have permission to do that";
	}
	json = createJSON(out, "Server", type, channel);
	if(type == "error") {
		connectedClients[userList[userName].id].sendUTF(json);
	} else {
		broadcastMsg(json, channel);
		var clientUserlist = createUserlist(channel);
		type = "users";
		json = createJSON(clientUserlist, "Server", type, channel)
		broadcastMsg(json, channel);
	}
}
COMM.op.desc = "/op [username]<br/>";

/**
 *	DEOP
 */
COMM.deop = function(userName, channel, userToDeop) {
	var out, type, json,
	activeChannel = channelList[channel];

	// is user op?
	if(activeChannel.ops.indexOf(userName) > -1) {
		// is target in channel?
		if(activeChannel.users.indexOf(userToDeop) > -1) {
			// is target op?
			var index = activeChannel.ops.indexOf(userToDeop)
			// is target owner? don't allow deop of owner
			if(index > -1 && activeChannel.created.who != userToDeop) {
				// remove target
				activeChannel.ops.splice(index, 1);
				type = "status";
				out = userToDeop + " was deoped by " + userName;
			} else if(activeChannel.created.who == userToDeop) {
				type = "error";
				out = "You can't deop the owner";
			} else {
				type = "error";
				out = "User doesn't have op";
			}
		} else {
			type = "error";
			out = "User is not in channel";
		}
	} else {
		// user is not op
		type = "error";
		out = "You don't have permission to do that";
	}
	json = createJSON(out, "Server", type, channel);
	if(type == "error") {
		connectedClients[userList[userName].id].sendUTF(json);
	} else {
		// broadcast to channel
		// broadcast new userlist
		broadcastMsg(json, channel);
		var clientUserlist = createUserlist(channel);
		type = "users";
		json = createJSON(clientUserlist, "Server", type, channel)
		broadcastMsg(json, channel);
	}
}
COMM.deop.desc = "/deop [username]<br/>";

/**
 *	KICK
 */
COMM.kick = function(userName, channel, userToKick) {
	var type, out, json, activeChannel = channelList[channel];
	// is user op?
	if(activeChannel.ops.indexOf(userName) > -1) {
		// is target in channel?
		if(activeChannel.users.indexOf(userToKick) > -1) {
			// is target not op?
			var index = activeChannel.ops.indexOf(userToKick);
			if(index < 0) {
				// remove target from channel listings
				activeChannel.users.splice(index, 1);
				type = "status";
				out = userToKick + " was kicked from channel by " + userName;
				// remove channel from target listings and interface
				// TODO
				var target = userList[userToKick];
				target.leaveChannel(channel);
			} else if(activeChannel.created.who == userToKick) {
				type = "error";
				out = "You can't kick the owner";
			} else {
				type = "error";
				out = "User has op, deop before kicking";
			}
		} else {
			type = "error";
			out = "User is not in channel";
		}
	} else {
		// user is not op
		type = "error";
		out = "You don't have permission to do that";
	}
	json = createJSON(out, "Server", type, channel);
	if(type == "error") {
		connectedClients[userList[userName].id].sendUTF(json);
	} else {
		// broadcast to channel
		// broadcast new userlist
		broadcastMsg(json, channel);
		var clientUserlist = createUserlist(channel);
		type = "users";
		json = createJSON(clientUserlist, "Server", type, channel)
		broadcastMsg(json, channel);
	}
}
COMM.kick.desc = "/kick [username]<br/>";

/**
 *	BAN
 */
COMM.ban = function() {
	
	}
COMM.ban.desc = "";

/**
 *	UNBAN
 */
COMM.unban = function() {
	
	}
COMM.ban.desc = "";


/**
 *	QUIT
 */
COMM.quit = function() {
	
	}
COMM.quit.desc = "";

// -----------------------------------------------------------------------------
// CHANNEL as object
// -----------------------------------------------------------------------------
function Channel(user) {
	this.ops	=	[user];
	this.voice	=	[];
	this.bans	=	[];
	this.users	=	[];
	this.topic	=	false;
	this.created =	{
		who: user,
		time: (new Date()).getTime()
	};
}

Channel.prototype = {
	setTopic: function(text, user) {
		this.topic = {
			topicText: text,
			who: user,
			time: (new Date()).getTime()
		}
	},
	addUser: function(user) {
		this.users.push(user);
		
	},
	removeUser: function(user) {
		var index = this.users.indexOf(user);
		if(index > -1) {
			// remove from list
			this.users.splice(index, 1);
			return true;
		} else {
			return false;
		}
	},
	broadcastMsg: function(json) {
		var i, user;
		for(i in this.users) {
			user = userList[this.users[i]];
			user.sendMsg(json);
		}
	},
	createUserlist: function() {
		var i, pos, list = this.users.slice(0);
		for(i in this.ops) {
			pos = list.indexOf(this.ops[i]);
			list[pos] = "@" + list[pos];
		}
		list.sort();
		//		console.log(list);
		return list;
	},
	switchName: function(oldNick, newNick) {
		var pos;
		// find in userlist, switch
		pos = this.users.indexOf(oldNick);
		if(pos > -1) {
			this.users[pos] = newNick;
			// is op? switch
			pos = this.ops.indexOf(oldNick);
			if(pos > -1) {
				this.ops[pos] = newNick;
			}
		}
	},
	getNames: function() {
		var names, list = this.createUserlist();
		names = "Users currently in channel:<br/>";
		for(var i in list) {
			names += "[" + list[i] + "] ";
		}
		return names;
	},
	getCreated: function() {
		var time = new Date(this.created.time);
		return "Channel was created by " + this.created.who + " at " + time.toLocaleString();
	},
	getTopic: function() {
		//		this.topic = {
		//			topicText: text,
		//			who: user,
		//			time: (new Date()).getTime()
		//		}
		var time = new Date(this.topic.time);
		return !this.topic ? this.topic.topicText + ", set by " + this.topic.who + " at " + time.toLocaleString() : "";
	},
	isOp: function(user) {
		return this.ops.indexOf(user) > -1 ? true : false;
	},
	inChannel: function(user) {
		return this.users.indexOf(user) > -1 ? true : false;
	},
	addOp: function(user) {
		this.ops.push(user);
	}
}

// -----------------------------------------------------------------------------
// USER as object
// -----------------------------------------------------------------------------

function User(connection) {
	this.id	= connection.broadcastId;
	this.activeChannels	= [];
	this.ignores = [];
}

User.prototype = {
	idleTimer: 1000,
	getChannels: function() {
		return this.activeChannels;
	},
	addChannel: function(channel) {
		this.activeChannels.push(channel);
	},
	leaveChannel: function(channel) {
		var index = this.activeChannels.indexOf(channel);
		if(index > -1) {
			// remove channel from list
			this.activeChannels.splice(index, 1);
			// toggle window in interface
			var json = JSON.stringify({
				type: "toggle",
				name: channel
			});
			this.sendMsg(json);
			return true;
		} else {
			return false;
		}
	},
	sendMsg: function(json) {
		connectedClients[this.id].sendUTF(json);
	},
	getInfo: function(nick) {
		var info = nick + "@" + connectedClients[this.id].remoteAddress + "<br/>";
		info += "Channels: ";
		for(var i in this.activeChannels) {
			info += "#" + this.activeChannels[i] + " ";
		}
		//		var time = new Date(connectedClients[this.id].socket._idleStart);
		//		if((new Date().getTime() - time) > User.idleTimer) {
		//			info += "<br/>Idle: " + time.toLocaleString();
		//		}
		return info;
	},
	isIn: function(channel) {
		return this.activeChannels.indexOf(channel) > -1 ? true : false;
	}
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
						COMM.help(userName, whatComm);
						break;
					case("msg"):
						args = msg.split(" ");
						args.shift(); // remove command
						nick = args.shift();
						msg = args.join(" ");
						COMM.msg(userName, nick, msg)
						break;
					case("me"):
						args = msg.split(" ");
						args.shift(); // remove command
						var action = args.join(" ");
						COMM.me(userName, channel, action);
						break;
					case("nick"):
						args = msg.split(" ");
						args.shift();
						nick = args.shift();
						userName = COMM.nick(userName, nick);
						break;
					case("whois"):
						args = msg.split(" ");
						args.shift();
						nick = args.shift();
						COMM.whois(userName, nick);
						break;
					//					case("slap"):
					//						break;
					case("list"):
						COMM.list(userName);
						break;
					case("names"):
						args = msg.split(" ");
						args.shift();
						var listChannel = args.shift();
						if(listChannel === undefined || listChannel === "") {
							COMM.names(userName, channel);
						} else if(listChannel !== channel) {
							listChannel = listChannel.replace("#", "");
							COMM.names(userName, listChannel);
						}
						break;
					case("join"):
						args = msg.split(" ");
						args.shift();
						channel = args.shift();
						if(channel !== undefined || channel )
							channel = channel.replace("#", "");
						COMM.join(userName, channel);
						break;
					case("part"):
						args = msg.split(" ");
						args.shift();
						var partChannel = args.shift();
						if(partChannel === undefined || partChannel === "") {
							COMM.part(userName, channel);
						} else if(partChannel !== channel) {
							partChannel = partChannel.replace("#", "");
							COMM.part(userName, partChannel);
						} else {
							COMM.part(userName, channel);
						}
						break;
					case("leave"):
						args = msg.split(" ");
						args.shift();
						var leaveChannel = args.shift();
						if(leaveChannel === undefined || leaveChannel === "") {
							COMM.leave(userName, channel);
						} else if(leaveChannel !== channel) {
							leaveChannel = leaveChannel.replace("#", "");
							COMM.leave(userName, leaveChannel);
						} else {
							COMM.leave(userName, channel);
						}
						break;
					case("topic"):
						args = msg.split(" ");
						args.shift();
						var topicTxt = args.shift();
						COMM.topic(userName, channel, topicTxt);
						break;
					case("op"):
						args = msg.split(" ");
						args.shift();
						var target = args.shift();
						COMM.op(userName, channel, target);
						break;
					case("deop"):
						args = msg.split(" ");
						args.shift();
						var target = args.shift();
						COMM.deop(userName, channel, target);
						break;
					case("kick"):
						args = msg.split(" ");
						args.shift();
						var target = args.shift();
						COMM.kick(userName, channel, target);
						break;
					//					case("ban"):
					//						break;
					//					case("unban"):
					//						break;
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
		var time, user = userList[userName];
		time = new Date();
		console.log(time + " Peer " + connection.remoteAddress + " disconnected broadcastid = " + connection.broadcastId + ".");
		//		message = "User " +  userName + " disconnected";
		//		json = createJSON(message, "Server", "message");
		clearUserFromAllChannels(user, userName);
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

///**
//*	Broadcast JSON to clients
//*/
//function broadcastMsg(json, channel) {
//	var i, users, user;
//	users = channelList[channel].users;
//	for(i in users) {
//		user = userList[users[i]];
//		connectedClients[user.id].sendUTF(json);
//	}
//}

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