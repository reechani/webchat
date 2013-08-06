/**
 * Create a stripped websocket-server using the sample code from:
 * https://github.com/Worlize/WebSocket-Node#server-example
 *
 */
var port = 8042;
var connectedClients = [];
var userList = {};
var channelList = {};

// message and nick restricitons
var COMM = {
	max_nick: 12,
	max_msg: 256
};

// Require the modules we need
var WebSocketServer = require("websocket").server;
var http = require("http");

/**
 * Create a http server with a callback for each request
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

// -----------------------------------------------------------------------------
// SERVER aid-functions
// -----------------------------------------------------------------------------

/**
 * Always check and explicitly allow the origin
 *	Currently allows the server it is run on and if run locally
 */
function originIsAllowed(origin) {
	if(origin === "http://www.student.bth.se" || origin === "http://localhost") {
		return true;
	}
	return false;
}

/**
 * Check if the user is online (among userList)
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
 */
function rand(min, max) {
	return Math.floor((Math.random()*max)+min);
}

/**
 *	Clears user from all channel listings, used on quit/disconnect
 */
function clearUserFromAllChannels(userName) {
	var i, json, out, target, user = userList[userName];
	var channels = user.getChannels();
	var privs = user.getPrivs();
	// loop all channels for user
	for(i in channels) {
		var channelName = channels[i];
		var channel = channelList[channelName];
		// leave channel
		if(user.leaveChannel(channelName)) {
			// remove user from channel's list
			if(channel.removeUser(userName)) {
				console.log("User removed from channel");
				console.log(channel);
				// send userlist
				json = createJSON(channel.createUserlist(), "Server", "users", channelName)
				console.log(json);
				channel.broadcastMsg(json);

				// message to channel
				out = userName + " has quit";
				json = createJSON(out, "Server", "status", channelName);
				console.log(json);
				channel.broadcastMsg(json);
			}
		}
	}
	// message to all privs
	for(i in privs) {
		target = userList[privs[i]];
		// is target user online?
		if(target !== undefined) {
			// send quit message to priv window
			channelName = userName + ":private";
			out = userName + " has quit";
			json = createJSON(out, userName, "status", channelName);
			target.sendMsg(json);
		}
	}
}

/**
 *	Creates and sends private window message - /me or text
 */
function sendPrivate(sender, reciever, msg, type) {
	var json, target = userList[reciever], user = userList[sender];
	// add to privs if not in it
	if(user.isInPriv(reciever) == false) {
		user.addPriv(reciever);
	}
	// target message
	json = createJSON(msg, sender, type, sender+":private");
	target.sendMsg(json);
	// self message
	json = createJSON(msg, sender, type, reciever+":private");
	user.sendMsg(json);
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
	//console.log(json);
	return json;
}

/**
 * Avoid injections
 */
function htmlEntities(str) {
	return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// -----------------------------------------------------------------------------
// COMMAND functions, COMM-object
// -----------------------------------------------------------------------------

/**
 * Validate a function name
 */
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
COMM.help = function(sender, command) {
	var out = "", json, type, user = userList[sender];
	if(!command) {
		// view all commands
		// loop all commands, and add the ones with a desc
		for(var propt in COMM) {
			if(COMM[propt].desc !== undefined) {
				out += propt + "&#09;";
			}
		}
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
	} else if(msg.replace(/\s/g, "").length === 0){ // check that message is not empty
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
			user.sendMsg(json);
			break;
		case("private"):
			sendPrivate(sender, nick, out, type);
			break;
	}
}
COMM.msg.desc = "/msg [nick] [message]<br/>"
+ "<br/>" + "Send a private message to another user"
+ "<br/>" + "Example: /msg Charlie Hi, how are you?";

/**
 *	ME
 */
COMM.me = function(sender, channelName, msg, isPriv) {
	var out, json, type, user = userList[sender], channel = channelList[channelName];
	// check that channel was not empty, or if priv
	if(channel !== undefined || isPriv === true) {
		// empty message allowed, but no undefined
		if(msg === undefined) {
			msg = "";
		}
		out = sender + " " + msg;
		type = "action";
	} else {
		type = "error";
		out = "Must write command in channel window";
	}

	json = createJSON(out, "Server", type, channelName);
	if(type == "error") {
		user.sendMsg(json);
	} else {
		if(isPriv === true) {
			// to priv
			sendPrivate(sender, channelName, out, type);
		} else {
			// broadcast to channel
			channel.broadcastMsg(json);
		}
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
			var privs = user.getPrivs();
			// send update message of namechange to all active privs
			for(i in privs) {
				var target = userList[privs[i]];
				// is online?
				if(target !== undefined) {
					json = createJSON("", nick, "update", sender + ":private");
					target.sendMsg(json);
				}
			}
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
+ "<br/>" + "Used to change your visible nickname"
+ "<br/>" + "Only numbers and letters allowed";

/**
 *	WHOIS
 */
COMM.whois = function(sender, nick) {
	var out, type, json, user = userList[sender], target = userList[nick];
	// no empty paramater
	if(nick === undefined || nick === "") {
		type = "error";
		out = "Nickname can not be empty";
	} else {
		// target online?
		if(target !== undefined) {
			type = "notice";
			out = target.getInfo(nick);
		} else {
			type = "error";
			out = "User is not online";
		}
	}

	json = createJSON(out, "Server", type, false);
	user.sendMsg(json);
}
COMM.whois.desc = "/whois [username]<br/>"
+ "<br/>" + "Prints information about user";

/**
 *	LIST
 */
COMM.list = function(userName) {
	var out, type, json, user = userList[userName];
	// get all channels and make string to send
	if(Object.keys(channelList).length > 0) {
		out = "Active channels:<br/>";
		for(var channel in channelList) {
			out += "#" + channel + "<br/>";
		}
	} else {
		out = "No active channels";
	}
	type = "notice";
	json = createJSON(out, "Server", type, false);
	user.sendMsg(json);
}
COMM.list.desc = "/list<br/>"
+ "<br/>" + "Lists all currently active channels";

/**
 *	NAMES
 */
COMM.names = function(userName, channelName, toLog) {
	var out, type, json, user = userList[userName], channel = channelList[channelName];

	// not names for empty/missing channel or log
	if(channelName !== "log" && channel !== undefined) {
		out = "Users currently in #" + channelName +  ":<br/>" + channel.getNames();
		// if toLog was set, channel came from parameter, print to log (notice)
		if(toLog === true) {
			type = "notice";
		} else {
			type = "status";
		}
	} else {
		type = "error";
		out = "Invalid channel, cannot list users for " + channelName;
	}

	json = createJSON(out, "Server", type, channelName);
	user.sendMsg(json);
}
COMM.names.desc = "/names (channel)<br/>"
+ "<br/>" + "Lists all users currently in channel"
+ "<br/>" + "If option argument is left out it will print users of the channel command was written in";

/**
 *	JOIN
 */
COMM.join = function(userName, channelName) {
	var out, type, json, user = userList[userName], channel = channelList[channelName];
	// is string empty?
	if(channelName !== undefined && channelName !== "") {
		// does channel exist?
		if(channel === undefined) {
			channel = channelList[channelName] = new Channel(userName);
		}
		// check: user not in channel
		if(!user.isInChannel(channelName)) {
			// tell client to open window
			json = JSON.stringify({
				type: "toggle",
				name: channelName
			});
			user.sendMsg(json);

			// add user
			channel.addUser(userName);
			user.addChannel(channelName);

			// send channel creation info back to user
			type = "status";
			json = createJSON(channel.getCreated(), "Server", type, channelName);
			user.sendMsg(json);
			// send topic
			type = "topic";
			json = createJSON(channel.getTopicText(), "Server", type, channelName);
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

			// is banned?
			if(channel.isBanned(userName)) {
				// kick and notify
				// remove target from channel listings
				channel.removeUser(userName);
				// remove channel from target listings and interface
				user.leaveChannel(channelName);

				type = "status";
				out = userName + " was kicked from channel by the server";
				json = createJSON(out, "Server", type, channelName);
				channel.broadcastMsg(json);
				// send message notice to target user
				out = "You where kicked from #" + channelName + " by the server. Reason: banned.";
				json = createJSON(out, "Server", "notice", channelName);
				user.sendMsg(json);
				// send userlist back to user
				type = "users";
				json = createJSON(channel.createUserlist(), "Server", type, channelName)
				channel.broadcastMsg(json);
			}
		} else {
			out = "You're already in " + channelName;
			type = "error";
			json = createJSON(out, "Server", type, channelName);
			user.sendMsg(json);
		}
	} else {
		out = "Parameter missing";
		type = "error";
		json = createJSON(out, "Server", type, channelName);
		user.sendMsg(json);
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
			json = createJSON(channel.createUserlist(), "Server", "users", channelName)
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
	// same function ability as /part, use that
	COMM.part(userName, channelName);
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
	if(channel === undefined) {
		out = "Can't get topic for " + channelName;
		json = createJSON(out, "Server", "error", channelName);
		user.sendMsg(json);
	} else if(topic !== undefined && topic !== "") {
		//is user op?
		if(channel.isOp(userName)) {
			// op
			channel.setTopic(topic, userName);
			out = userName + " set topic to: " + topic; // broadcast to channel
			type = "status";
			json = createJSON(out, "Server", type, channelName);
			channel.broadcastMsg(json);
			// send new topic text to inferface
			out = topic;
			type = "topic";
			json = createJSON(out, userName, type, channelName);
			channel.broadcastMsg(json);
		} else {
			// not op
			out = "You don't have permission to change topic";
			type = "error";
			// unicast
			json = createJSON(out, "Server", type, channelName);
			user.sendMsg(json);
		}
	} else {
		// print it to user
		out = channel.getTopic();
		if(out === false) {
			// if topic is not set, give that msg instead
			out = "Topic not set";
		}
		type = "status";
		json = createJSON(out, "Server", type, channelName);
		user.sendMsg(json);
	}
}
COMM.topic.desc = "/topic (text)<br/>"
+ "<br/>" + "Used to see or set a topic text for a channel"
+ "<br/>" + "Just writing /topic will display it, adding text after will atempt to set it"
+ "<br/>" + "Can only set topic as op"
+ "<br/>" + "Needs to be written in the channel window of which you want to set/see it"

/**
 *	OP
 */
COMM.op = function(userName, channelName, userToOp) {
	var out, type, json,
	user = userList[userName], channel = channelList[channelName];
	// channel must exist
	if(channel !== undefined) {
		// is username op?
		if(userToOp !== undefined || userToOp !== "") {
			if(channel.isOp(userName)) {
				// user is op
				// is target in channel?
				if(channel.inChannel(userToOp)) {
					// is target already op?
					if(!channel.isOp(userToOp)) {
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
		} else {
			type = "error";
			out = "Paramater missing";
		}
	} else {
		type = "error";
		out = "Must write in channel";
	}
	json = createJSON(out, "Server", type, channelName);
	if(type == "error") {
		user.sendMsg(json);
	} else {
		channel.broadcastMsg(json);
		// send updated userlist
		type = "users";
		json = createJSON(channel.createUserlist(), "Server", type, channelName);
		channel.broadcastMsg(json);
	}
}
COMM.op.desc = "/op [username]<br/>"
+ "<br/>" + "Used to elevate user to operator"
+ "<br/>" + "Op status needed to preform command"
+ "<br/>" + "Operators can set topic, op, deop, kick, ban and unban users from channel in which oped"
+ "<br/>" + "Needs to be written in the channel window of which target user is in";

/**
 *	DEOP
 */
COMM.deop = function(userName, channelName, userToDeop) {
	var out, type, json,
	user = userList[userName], channel = channelList[channelName];
	// channel must exist
	if(channel !== undefined) {
		// user can not be empty
		if(userToDeop !== undefined || userToDeop !== "") {
			// is user op?
			if(channel.isOp(userName)) {
				// is target op?
				if(channel.isOp(userToDeop)) {
					// is target owner? don't allow deop of owner
					if(!channel.isOwner(userToDeop)) {
						// remove target
						channel.removeOp(userToDeop);
						type = "status";
						out = userToDeop + " was deoped by " + userName;
					} else {
						type = "error";
						out = "You can't deop the owner";
					}
				} else {
					type = "error";
					out = "User doesn't have op";
				}
			} else {
				// user is not op
				type = "error";
				out = "You don't have permission to do that";
			}
		} else {
			type = "error";
			out = "Paramater missing";
		}
	} else {
		type = "error";
		out = "Must write command in target channel";
	}
	json = createJSON(out, "Server", type, channelName);
	if(type == "error") {
		user.sendMsg(json);
	} else {
		// broadcast to channel
		channel.broadcastMsg(json);
		// broadcast new userlist
		type = "users";
		json = createJSON(channel.createUserlist(), "Server", type, channelName)
		channel.broadcastMsg(json);
	}
}
COMM.deop.desc = "/deop [username]<br/>"
+ "<br/>" + "Used to remove status of operator from user"
+ "<br/>" + "Op status needed to preform command"
+ "<br/>" + "User does not need to be in channel or online for this command"
+ "<br/>" + "Needs to be written in the channel window of which target user is operator of";

/**
 *	KICK
 */
COMM.kick = function(userName, channelName, userToKick) {
	var out, type, json,
	user = userList[userName], channel = channelList[channelName],
	target = userList[userToKick];
	// channel must be set
	if(channel !== undefined) {

		if(userToKick !== undefined && userToKick !== "") {
			// is user op?
			if(channel.isOp(userName)) {
				// is target in channel?
				if(channel.inChannel(userToKick)) {
					// is target not op?
					if(!channel.isOp(userToKick)) {
						// remove target from channel listings
						channel.removeUser(userToKick);
						// remove channel from target listings and interface
						target.leaveChannel(channelName);
						type = "status";
						out = userToKick + " was kicked from channel by " + userName;
					} else if(channel.isOwner(userToKick)) {
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
		} else {
			type = "error";
			out = "Paramater missing";
		}
	} else {
		type = "error";
		out = "Must write command in target channel";
	}
	json = createJSON(out, "Server", type, channelName);
	if(type == "error") {
		user.sendMsg(json);
	} else {
		// broadcast to channel
		channel.broadcastMsg(json);
		// broadcast new userlist
		type = "users";
		json = createJSON(channel.createUserlist(), "Server", type, channelName)
		channel.broadcastMsg(json);
		// message to target
		out = "You where kicked from #" + channelName;
		json = createJSON(out, "Server", "notice", false);
		target.sendMsg(json);
	}
}
COMM.kick.desc = "/kick [username]<br/>"
+ "<br/>" + "Used to forcefully remove a user from channel"
+ "<br/>" + "Op status needed to preform command"
+ "<br/>" + "Needs to be written in the channel window of which target user is in";

/**
 *	BAN
 */
COMM.ban = function(userName, channelName, userToBan) {
	var out, type, json,
	user = userList[userName], channel = channelList[channelName],
	target = userList[userToBan];
	// channel must exist
	if(channel !== undefined) {
		// target must be set
		if(userToBan !== undefined && userToBan !== "") {
			// is user op? n -> e, no perm
			if(channel.isOp(userName)) {
				// is target op? y -> e, deop first
				if(!channel.isOp(userToBan)) {
					// sidenote: does not need to be in channel, or online
					// is already banned? y -> e, already banned
					if(!channel.isBanned(userToBan)) {
						// add ban
						channel.addBan(userToBan);
						// notify user, channel and target, if online
						type = "status";
						out = userToBan + " has been banned by " + userName;
						json = createJSON(out, "Server", type, channelName);
						channel.broadcastMsg(json);
						if(target !== undefined) {
							type = "notice";
							out = "You were banned from " + channelName + " by " + userName;
							json = createJSON(out, "Server", type, channelName);
							target.sendMsg(json);
						}
					} else {
						type = "error";
						out = userToBan + " is already banned";
					}
				} else {
					type = "error";
					out = userToBan + " is op, deop before banning";
				}

			} else {
				type = "error";
				out = "You don't have permission to do that";
			}
		} else {
			type = "error";
			out = "Parameter missing";
		}
	} else {
		type = "error";
		out = "Must write command in target channel";
	}
	if(type == "error") {
		json = createJSON(out, "Server", type, channelName);
		user.sendMsg(json);
	}
}
COMM.ban.desc = "/ban [username]<br/>"
+ "<br/>" + "Used to disallow a user to write or join channel"
+ "<br/>" + "Op status needed to preform command"
+ "<br/>" + "User does not need to be in channel or online"
+ "<br/>" + "Needs to be written in the channel window of which target user is to be banned from";

/**
 *	UNBAN
 */
COMM.unban = function(userName, channelName, userToUnban) {
	var json, out, type, target = userList[userToUnban],
	user = userList[userName], channel = channelList[channelName];
	// check that channel and user exist
	if(channel !== undefined) {
		// check that username is op
		if(channel.isOp(userName)) {
			if((userToUnban !== undefined && userToUnban !== "")) {
				// check that target is in the banlist
				if(channel.isBanned(userToUnban)) {
					channel.removeBan(userToUnban);
					type = "status";
					out = userToUnban + " has been unbanned by " + userName;
				} else {
					type = "error";
					out = userToUnban + " is not in the banlist";
				}
			} else {
				// no name sent, print list
				type = "notice";
				out = channel.getBanlist();
			}
		} else {
			type = "error";
			out = "You don't have permission to do that";
		}
	} else {
		type = "error";
		out = "Parameter missing or invalid";
	}
	json = createJSON(out, "Server", type, channelName);
	switch(type) {
		case("notice"):
		case("error"):
			user.sendMsg(json);
			break;
		case("status"):
			channel.broadcastMsg(json);
			break;
	}
}
COMM.unban.desc = "/unban (username)<br/>"
+ "<br/>" + "Used to list banned users or to remove a user from banlist"
+ "<br/>" + "Just writing /unban will list the users"
+ "<br/>" + "Op status needed to preform command"
+ "<br/>" + "User does not need to be in channel or online"
+ "<br/>" + "Needs to be written in the channel window of which target user is to be unbanned from";

// -----------------------------------------------------------------------------
// CHANNEL as object
// -----------------------------------------------------------------------------
function Channel(user) {
	this.ops	=	[user];
	//this.voice	=	[];
	this.bans	=	[];
	this.users	=	[];
	this.topic	=	false;
	this.created =	{
		who: user,
		time: (new Date()).getTime()
	};
}

Channel.prototype = {
	// getters
	createUserlist: function() {
		var i, pos, list = this.users.slice(0);
		for(i in this.ops) {
			pos = list.indexOf(this.ops[i]);
			if(pos > -1) {
				list[pos] = "@" + list[pos];
			}
		}
		list.sort();
		//		console.log(list);
		return list;
	},
	getBanlist: function() {
		var i, list = "Users currently banned:<br/>";
		for(i in this.bans) {
			list += this.bans[i] + "<br/>";
		}
		return list;
	},
	getCreated: function() {
		var time = new Date(this.created.time);
		return "Channel was created by " + this.created.who + " at " + time.toLocaleString();
	},
	getNames: function() {
		var names, list = this.createUserlist();
		names = "";
		for(var i in list) {
			names += "[" + list[i] + "] ";
		}
		return names;
	},
	getTopic: function() {
		var time = new Date(this.topic.time);
		return this.topic !== false ? this.topic.topicText + ", set by " + this.topic.who + " at " + time.toLocaleString() : false;
	},
	getTopicText: function() {
		return this.topic !== false ? this.topic.topicText : "";
	},
	// setters
	addBan: function(user) {
		this.bans.push(user);
	},
	addOp: function(user) {
		this.ops.push(user);
	},
	addUser: function(user) {
		this.users.push(user);

	},
	removeBan: function(user) {
		var index = this.bans.indexOf(user);
		if(index > -1) {
			this.bans.splice(index, 1);
			return true
		} else {
			return false;
		}
	},
	removeOp: function(user) {
		var index = this.ops.indexOf(user);
		if(index > -1) {
			this.ops.splice(index, 1);
			return true;
		} else {
			return false;
		}
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
	setTopic: function(text, user) {
		this.topic = {
			topicText: text,
			who: user,
			time: (new Date()).getTime()
		}
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
	// checks
	inChannel: function(user) {
		return this.users.indexOf(user) > -1 ? true : false;
	},
	isBanned: function(user) {
		return this.bans.indexOf(user) > -1 ? true : false;
	},
	isOp: function(user) {
		return this.ops.indexOf(user) > -1 ? true : false;
	},
	isOwner: function(user) {
		return user == this.created.who ? true : false;
	},
	// other
	broadcastMsg: function(json) {
		var i, user;
		for(i in this.users) {
			user = userList[this.users[i]];
			user.sendMsg(json);
		}
	}
}

// -----------------------------------------------------------------------------
// USER as object
// -----------------------------------------------------------------------------

function User(connection) {
	this.id	= connection.broadcastId;
	this.activeChannels	= [];
	//this.ignores = [];
	this.privs = [];
}

User.prototype = {
	// variables
	idleTimer: 1000,
	// getters
	getChannels: function() {
		return this.activeChannels;
	},
	getInfo: function(nick) {
		var info = nick + "@" + connectedClients[this.id].remoteAddress + "<br/>";
		info += "Channels: ";
		for(var i in this.activeChannels) {
			info += "#" + this.activeChannels[i] + " ";
		}
		return info;
	},
	getPrivs: function() {
		return this.privs;
	},
	// setters
	addChannel: function(channel) {
		this.activeChannels.push(channel);
	},
	addPriv: function(nick) {
		this.privs.push(nick);
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
	// checks
	isInChannel: function(channel) {
		return this.activeChannels.indexOf(channel) > -1 ? true : false;
	},
	isInPriv: function(nick) {
		return this.privs.indexOf(nick) > -1 ? true : false;
	},
	// other
	sendMsg: function(json) {
		connectedClients[this.id].sendUTF(json);
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
			// only take first word
			nick = clientMsg.msg.split(" ")[0];
			nick = nick.replace(/[^a-zA-Z0-9]/g, "");
			// max length: 12
			if(nick.length > COMM.max_nick) {
				nick = nick.slice(0, COMM.max_nick);
			}

			while(isNickUsed(nick)) {
				out = "Nick " + nick + " is already in use. ";
				nick += rand(0, 9);
			}
			userName = nick;

			console.log(time + " User is known as: " + userName);
			// add to userlist
			userList[userName] = new User(connection);

			out = "Your are known as " + nick;
			json = createJSON(out, "Server", "notice", false);
			userList[userName].sendMsg(json);
		} else {
			channel = clientMsg.window;
			msg = htmlEntities(clientMsg.msg.substr(0, COMM.max_msg));
			// what type of msg? text or command?
			// is priv? :private
			var isPriv = false;
			if(channel.indexOf(":private") > -1) {
				isPriv = true;
				channel = channel.split(":")[0];
			}
			// is command? /
			// written in log?
			if(msg.substr(0, 1) === "/") {
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
						COMM.me(userName, channel, action, isPriv);
						break;
					case("nick"):
						args = msg.split(" ");
						args.shift();
						nick = args.shift();
						// remove chars
						if(nick !== undefined && nick !== "") {
							nick = nick.replace(/&.{0,}?;/g, "");
							nick = nick.replace(/[^a-zA-Z0-9]/g, "");
						}
						userName = COMM.nick(userName, nick);
						break;
					case("whois"):
						args = msg.split(" ");
						args.shift();
						nick = args.shift();
						COMM.whois(userName, nick);
						break;
					case("list"):
						// takes no arguments
						COMM.list(userName);
						break;
					case("names"):
						args = msg.split(" ");
						args.shift();
						var listChannel = args.shift();
						// if no argument, do for active channel
						if(listChannel === undefined || listChannel === "") {
							COMM.names(userName, channel);
						} else if(listChannel !== channel) {
							// do for argument sent
							listChannel = listChannel.replace("#", "");
							COMM.names(userName, listChannel, true);
						} else {
							listChannel = listChannel.replace("#", "");
							COMM.names(userName, listChannel);							
						}
						break;
					case("join"):
						args = msg.split(" ");
						args.shift();
						channel = args.shift();
						if(channel !== undefined && channel !== "") {
							channel = channel.replace(/&.{0,}?;/g, "");
							channel = channel.replace(/[^a-zA-Z0-9]/g, "");
							channel = channel.replace("#", "");
						}
						COMM.join(userName, channel);
						break;
					case("part"):
						args = msg.split(" ");
						args.shift();
						var partChannel = args.shift();
						// if no argument, do for window sent from
						if(partChannel === undefined || partChannel === "") {
							COMM.part(userName, channel);
						} else if(partChannel !== channel) {
							// do for argument
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
					case("ban"):
						args = msg.split(" ");
						args.shift();
						var target = args.shift();
						COMM.ban(userName, channel, target);
						break;
					case("unban"):
						args = msg.split(" ");
						args.shift();
						var target = args.shift();
						COMM.unban(userName, channel, target);
						break;
					default:
						// send message that command does not exist
						message = "Unknown command: " + msg;
						json = createJSON(message, "Server", "notice", false);
						connectedClients[connection.broadcastId].sendUTF(json);
						break;
				}
			} else {
				if(channel !== "log") {
					console.log(time + " Recieved message from " + userName + ": " + msg);
					if(isPriv === true) {
						// to priv window
						COMM.msg(userName, channel, msg);
					} else {
						var channelObject = channelList[channel];
						if(channelObject.isBanned(userName) === true) {
							var user = userList[userName];
							out = "Can not write to channel - banned";
							json = createJSON(out, userName, "error", channel);
							user.sendMsg(json);
						} else {
							// public message, do broadcast
							json = createJSON(msg, userName, "message", channel);
							channelObject.broadcastMsg(json);
						}
					}
				}

			}
		}
	});

	// Callback when client closes the connection
	connection.on("close", function(reasonCode, description) {
		var time = new Date();
		console.log(time + " Peer " + connection.remoteAddress + " disconnected broadcastid = " + connection.broadcastId + ".");
		clearUserFromAllChannels(userName);
		delete userList[userName];
		connectedClients[connection.broadcastId] = null;
	});

	return true;
}

/**
*	Create a callback to handle each connection request
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
	var size = request.requestedProtocols.length;
	for (var i=0; i < size; i++) {
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
