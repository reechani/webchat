/**
 * A websocket client.
 */
$(document).ready(function(){
	"use strict";
	
	var url = "ws://seekers.student.bth.se:8042/",
	websocket = null,
	output = $("#log"),
	userName,
	channels = {},
	active,
	timer;
	
	// hide textdiv as default.
	$("#chatWindow").hide();

	// Display the url in form field for the user to change
	$("#connect_url").val(url);
	
	$("option").text("");

	/**
	 * Eventhandler to create the websockt connection
	 */
	$("#connect").on("click", function(event) {
		// check that nick is not empty
		userName = $("#nick").val().replace(/[^a-zA-Z0-9]/g, "");
		if(userName === "") {
			outputStatus("Nick cannot be empty.");
			return;
		}
		// hide the connection form
		$("#connectForm").hide();
		// show the chat window
		$("#chatWindow").show();
		
		// get the url to connect to
		url = $("#connect_url").val();
		console.log("Connecting to: " + url);
		if(websocket) {
			websocket.close();
			websocket = null;
		}
		// connect with the chat-protocol
		try {
			websocket = new WebSocket(url, "chat-protocol");
		} catch(e) {
			// reset output content
			$("#output").html("");
			// hide chat
			$("#chatWindow").hide();
			// show connection form
			$("#connectForm").show();
			clear(); // clears all chat content and variables
			if(e.name === "SyntaxError") {
				outputStatus("Invalid url");
			} else {
				outputStatus("Disconnected from chat");
			}
			return;
		}

		websocket.onopen = function() {
			console.log("The websocket is now open.");
			console.log(websocket);
			outputLog("The websocket is now open.");
			
			// save log as a channel - for history
			channels.log = {
				name: "[status]",
				history: $("#log").html(),
				topic: "Status window"
			}
			// update the list if channels
			updateChannels();
			// set log as chosen in list
			$("#channelList").val("log");
			// set active variable for later
			active = "log";
			
			// first message to server should be nickname
			var json = JSON.stringify({
				window: "log",
				msg: userName
			});
			websocket.send(json);
		}

		websocket.onmessage = function(event) {			
			try {
				var json = JSON.parse(event.data);
			} catch (e) {
				console.log("This doesn't look like a valid JSON: ", event.data);
				return;
			}
			
			// print out message recieved in console
			console.log(json);
			
			// action based on message type
			switch(json.type) {
				case("message"): // message - simple text to channel window
					outputSpecific(json.data, json.type);
					break;
				case("private"): // private message to user window
					checkPrivateWindow(json.data.channel);
					outputSpecific(json.data, json.type);
					break;
				case("notice"): // notice is always printed to log window
					outputNotice(json.data);
					break;
				case("error"): // displays error, in any active window
					outputError(json.data);
					break;
				case("action"): // action is printed to channel or private with * infront
					outputSpecific(json.data, json.type);
					break;
				case("status"): // status is server response, specific
					outputSpecific(json.data, json.type);
					break;
				case("toggle"): // toggles a window to open or close (channels)
					toggleChannel(json.name);
					break;
				case("users"): // userlist for a channel
					updateUsers(json.data.text, json.data.channel);
					break;
				case("topic"): // sets topic above chatwindow, specific channel only
					changeTopic(json.data);
					break;
				case("update"): // updates a private windows target name
					changePrivName(json.data);
				default:
					break;
			}
		}

		websocket.onclose = function() {
			console.log("The websocket is now closed.");
			console.log(websocket);
			// reset output content
			$("#output").html("");
			// hide chat
			$("#chatWindow").hide();
			// show connection form
			$("#connectForm").show();
			outputStatus("Disconnected from chat");
			clear(); // clears all chat content and variables
		}

	});
	
	// -------------------------------------------------------------------------
	// GUI and CHANNEL functions
	// -------------------------------------------------------------------------

	/**
	 * Updates channellist, keeping active channel
	 *	Used when joining or leaving a channel
	 */
	function updateChannels() {
		console.log("Updating channellist");
		var active = $("#channelList").val();
		var select = $("#channelList");
		var options;
		if(select.prop) {
			options = select.prop("options");
		} else {
			options = select.attr("options");
		}
		$("option", select).remove();
		
		$.each(channels, function(val, data) {
			options[options.length] = new Option(data.name, val);
		})
		$("#channelList").val(active);
	}
	
	/**
	 * Changes the active channel displayed in the output
	 *	Used when marking another channel/priv in the list
	 */
	function setActiveChannel(channel) {
		console.log("Setting channel as active: " + channel);
		console.log("Previous active: " + active);
		// save that from log right now to active channel object
		if(channels[active] !== undefined) {
			channels[active].history = $("#log").html();
		}
		// put history of new channel into log, and scroll to bottom
		$(output).html(channels[channel].history).scrollTop(output[0].scrollHeight);
		// change the name, topic and list to that of new active channel
		$("#hChannel").text(channels[channel].name);
		$("#hTopic").text(">> " + channels[channel].topic);
		$("#channelList").val(channel);
		// change active variable
		active = channel;
		// remove hilight from active channel
		removeChannelHilight(channel);
		// update userlist to channels
		updateUsers(channels[channel].users, channel);
	}
	
	/**
	 * Opens or closes a channel window
	 *	Used when joining or leaving a channel
	 */
	function toggleChannel(channel) {
		if(channels[channel] !== undefined) {
			// close channel
			console.log("Closing channel: " + channel);
			delete channels[channel];
			// update list so that channel is removed
			updateChannels();
			// clear users from list
			updateUsers([], false);
			// set status window as active
			setActiveChannel("log");
		} else {
			// open channel
			console.log("Opening channel: " + channel);
			addChannel(channel);
		}
	}
	
	/**
	 * Removes hilight from a specific channel in list
	 */
	function removeChannelHilight(channel) {
		$("#channelList option[value='" + channel + "']").removeClass("hilightChat");
	}
	
	/**
	 * Adds hilight to a specific channel in list
	 */
	function addChannelHilight(channel) {
		$("#channelList option[value='" + channel + "']").addClass("hilightChat");
	}

	/**
	 * Adds a channel as object to the array of channels
	 *	If it's a priv, it removes the ":private"-string from the name, for
	 *		proper display in list
	 *	Channel object consists of name(string), history(string), topic(string)
	 *		and users(array)
	 */
	function addChannel(channel, isPrivate) {
		// add the channel
		var channelName = channel;
		if(isPrivate === undefined) {
			channelName = "#" + channel;
		} else {
			channelName = channel.split(":")[0];
		}
		console.log("Adding channel: " + channel);
		channels[channel] = {
			name: channelName,
			history: "",
			topic: "",
			users: undefined
		}
		// update channellist, showing the added channel
		updateChannels();
		// set new channel as active
		setActiveChannel(channel);
	}
	
	/**
	 * Update userlist for a channel, changing the object's users
	 */
	function updateUsers(users, channel) {
		// if empty, set empty array
		if(users === undefined) {
			users = [];
		} else if(!Array.isArray(users)) { // if not array, split it into one
			users = users.split(",");
		}
		if(channel !== false) { // if channel is set, add users to that channel
			channels[channel].users = users;
		}
		if(channel === active) { // if it's an update for active channel, update list
			updateUserlist(channel);
		}
	}
	
	/**
	 * Updates the actual list seen in the window, for a channel given
	 */
	function updateUserlist(channel) {
		console.log("Updating userList");
		// get the active user
		var active = $("#userList").val();
		var select = $("#userList");
		var options;
		if(select.prop) {
			options = select.prop("options");
		} else {
			options = select.attr("options");
		}
		// remove every option
		$("option", select).remove();
		
		// for each user in channel, add a new option
		// the value set is the same as the name
		$.each(channels[channel].users, function(val, data) {
			options[options.length] = new Option(data, data);
		})
		// reset the active user
		$("#userList").val(active);
	}
	
	/**
	 * Changes the topic text above log window
	 */
	function changeTopic(data) {
		console.log("Showing/changing topic");
		// set the object's topic
		channels[data.channel].topic = data.text;
		// if active window, change text
		var active = $("#channelList").val();
		if(active === data.channel) {
			$("#hTopic").text(">> " + channels[data.channel].topic);
		}
	}
	
	/**
	 * Check if private window exists, add if it doesn't
	 */
	function checkPrivateWindow(from) {
		// not set?
		if(channels[from] === undefined) {
			addChannel(from, true);
		}
	}
	
	/**
	 * Changes the name of a priv window to that of author
	 */
	function changePrivName(data) {
		// author: to
		// channel: from
		var to = data.author + ":private";
		var from = data.channel;
		// save the channel (history and stuff)
		if(channels[to] === undefined) {
			var targetChannel = channels[from];
			// remove old one
			delete channels[from];
			// set the new position
			channels[to] = targetChannel;
			// change the name to the new name
			channels[to].name = data.author;
			// if active, save log, and update list
			/* log disappears on change if not saved to the new one */
			if(active == from) {
				console.log("priv was active, copied log, set to active");
				channels[to].history = $("#log").html();
				updateChannels();
				setActiveChannel(to);
			} else {
				// update to get the new name in list
				updateChannels();
			}
		} else {
			console.log("Priv window already exists with that name");
		}
	}
	
	/**
	 * Clear the GUI and variables for GUI
	 */
	function clear() {
		// clear window
		output.text("");
		// reset all channels
		channels = {};
		// remove active
		active = "";
		// empty lists
		$("#userList").empty();
		$("#channelList").empty();
		// empty name and topic fields
		$("#hChannel").empty();
		$("#hTopic").empty();
	}
	
	// -------------------------------------------------------------------------
	// OUTPUT functions
	// -------------------------------------------------------------------------

	/**
	 * Notice, always log
	 */
	function outputNotice(data) {
		var time = new Date(data.time);
		// fix for FF, enables htmlchars to be printed (tags, spaces and such)
		data.text = $("<div />").html(data.text).text();
		// is log active?
		if(active === "log") {
			$(output).append("[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>").scrollTop(output[0].scrollHeight);
		} else {
			// not active, add to history, hilight log
			channels.log.history += "[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>";
			addChannelHilight("log");
		}
	}
	
	/**
	 * Error, always active
	 */
	function outputError(data) {
		var time = new Date(data.time);
		// fix for FF, enables htmlchars to be printed (tags, spaces and such)
		data.text = $("<div />").html(data.text).text();
		$(output).append("[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>").scrollTop(output[0].scrollHeight);
	}
	
	/**
	 * Prints or adds history-text to a specific channel
	 */
	function outputSpecific(data, type) {
		var time = new Date(data.time),
		text = "[" + time.toLocaleTimeString() + "] ";
		data.text = $("<div />").html(data.text).text();
		// display the text in different formats
		switch(type) {
			case("action"):
				text += "* ";
				break;
			case("status"):
			case("topic"):
				text += "-!- ";
				break;
			case("message"):
			case("private"):
				text += "&#60;" + data.author + "&#62; ";
				break;
		}
		text += data.text + "<br/>";
		
		// output it to specific channel
		if(active === data.channel) {
			// to active
			$(output).append(text).scrollTop(output[0].scrollHeight);
		} else {
			// to history
			channels[data.channel].history += text;
			addChannelHilight(data.channel);
		}
	}
	
	/**
	 * Prints to the log-window (status)
	 */
	function outputLog(message) {
		var now = new Date();
		$(output).append("[" + now.toLocaleTimeString() + "] * " + message + "<br/>").scrollTop(output[0].scrollHeight);
	}
	
	/**
	 * Prints a timed message to status of connection form
	 */
	function outputStatus(msg) {
		$("#status").text(msg);
		clearTimeout(timer);
		timer = setTimeout(function(){
			$("#status").fadeOut(function(){
				$("#status").text("").fadeIn();
			});
		}, 3000);
	}

	// -------------------------------------------------------------------------
	// MESSAGE functions
	// -------------------------------------------------------------------------
	
	/**
	 * Sends a message on the socket
	 */
	function sendSocketMsg(msg) {
		if(!websocket || websocket.readyState === 3) {
			console.log("The websocket is not connected to a server.");
		} else {
			websocket.send(msg);
			$("#message").val("");
		}
	}	

	/**
	 * Send message if button was clicked
	 */
	$("#send_message").on("click", function(e) {
		// send message and active window
		var msg = $("#message").val();
		var channel = $("#channelList").val();
		// save message and active window
		var json = JSON.stringify({
			window: channel,
			msg: msg
		});
		sendSocketMsg(json);
	});
	/**
	 * Send message if enter was pressed in text input field
	 */
	$("#message").keydown(function(e) {
		// was enter?
		if(e.keyCode === 13) {
			var msg = $(this).val();
			if(!msg) {
				return;
			}
			var channel = $("#channelList").val();
			// save message and active window
			var json = JSON.stringify({
				window: channel,
				msg: msg
			});
			sendSocketMsg(json);
		}
	});
	
	/**
	 * Detect channel change
	 */
	$("#channelList").change(function() {
		setActiveChannel($(this).val());
	})

	/**
	 * Close button to disconnect, closes websocket
	 */
	$("#close").on("click", function() {		
		console.log("Closing websocket.");
		websocket.close();
		console.log(websocket);
	});
	
	/**
	 * Detect double click in userlist - opens new private window
	 */
	$("#userList").on("dblclick", function() {
		// get clicked user
		var user = $(this).val();
		// remove any elevated status signs
		if(user[0] == "@") {
			user = user.substr(1);
		}
		// add ":private" for correct list value
		user += ":private";
		// check, and add
		checkPrivateWindow(user);
	});
	
	// setup help icon
	$("#help").hide();
	$("#hicon").on("click", function() {
		var pos = $(this).position();
		var width = $("#help").outerWidth();
		$("#help").css({top: pos.top + 20, left: pos.left - width});
		$("#help").toggle();
	});

	console.log("Everything is ready.");
});
