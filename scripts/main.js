/**
 * A websocket client.
 */
$(document).ready(function(){
	"use strict";
	
	var url = "ws://jane.graveraven.net:57005/",
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


	// Event handler to create the websockt connection
	$("#connect").on("click", function(event) {
		if($("#nick").val() === "") {
			outputStatus("Nick cannot be empty.");
			return;
		}
		$("#connectForm").hide();
		$("#chatWindow").show();
		
		userName = $("#nick").val();
		url = $("#connect_url").val();
		console.log("Connecting to: " + url);
		if(websocket) {
			websocket.close();
			websocket = null;
		}
		websocket = new WebSocket(url, "chat-protocol");

		websocket.onopen = function() {
			console.log("The websocket is now open.");
			console.log(websocket);
			outputLog("The websocket is now open.");
			
			channels.log = {
				name: "[status]",
				history: $("#log").html(),
				topic: "Status window"
			}
			updateChannels();
			$("#channelList").val("log");
			active = "log";

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
			
			console.log(json);
			
			switch(json.type) {
				case("message"):
					outputSpecific(json.data, json.type);
					break;
				case("private"):
					json.data.channel += ":private";
					checkPrivateWindow(json.data.channel);
					outputSpecific(json.data, json.type);
					break;
				case("notice"):
					outputNotice(json.data);
					break;
				case("error"):
					outputError(json.data);
					break;
				case("action"):
					outputSpecific(json.data, json.type);
					break;
				case("status"):
					outputSpecific(json.data, json.type);
					break;
				case("toggle"):
					toggleChannel(json.name);
					break;
				case("users"):
					updateUsers(json.data.text, json.data.channel)
					break;
				case("topic"):
					changeTopic(json.data);
					break;
				default:
					break;
			}
		}

		websocket.onclose = function() {
			console.log("The websocket is now closed.");
			console.log(websocket);
			$("#output").html("");
			$("#chatWindow").hide();
			$("#connectForm").show();
			outputStatus("Disconnected from chat");
			clear();
		}
	});
	
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
	
	function setActiveChannel(channel) {
		console.log("Setting channel as active: " + channel);
		console.log("Previous active: " + active);
		// save that from log right now to active window
		if(channels[active] !== undefined) {
			channels[active].history = $("#log").html();
		}
		// put history in log
		$("#log").html(channels[channel].history);
		$("#hChannel").text(channels[channel].name);
		$("#hTopic").text(">> " + channels[channel].topic);
		$("#channelList").val(channel);
		active = channel;
		removeChannelHilight(channel);
		updateUsers(channels[channel].users, channel);
	}
	
	function toggleChannel(channel) {
		if(channels[channel] !== undefined) {
			// close channel
			console.log("Closing channel: " + channel);
			delete channels[channel];
			// remove channel from window aswell
			updateChannels();
			// clear users
			updateUsers([], false);
			setActiveChannel("log");
		} else {
			// open channel
			console.log("Opening channel: " + channel);
			addChannel(channel);
		}
	}
	
	function removeChannelHilight(channel) {
		$("#channelList option[value='" + channel + "']").removeClass("hilightChat");
	}
	
	function addChannelHilight(channel) {
		$("#channelList option[value='" + channel + "']").addClass("hilightChat");
	}

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
		// update list
		updateChannels();
		// set new channel as active
		setActiveChannel(channel);
	}
	
	function updateUsers(users, channel) {
		if(users === undefined) {
			users = [];
		} else if(!Array.isArray(users)) {
			users = users.split(",");
		}
		if(channel !== false) {
			channels[channel].users = users;
		}
		
		console.log("Updating userList");
		var active = $("#userList").val();
		var select = $("#userList");
		var options;
		if(select.prop) {
			options = select.prop("options");
		} else {
			options = select.attr("options");
		}
		$("option", select).remove();
		
		$.each(users, function(val, data) {
			options[options.length] = new Option(data, data);
		})
		$("#userList").val(active);
	}
	
	function changeTopic(data) {
		console.log("Showing/changing topic");
		channels[data.channel].topic = data.text;
		// if active window, change text
		var active = $("#channelList").val();
		if(active === data.channel) {
			$("#hTopic").text(">> " + channels[data.channel].topic);
		}
	}
	
	function checkPrivateWindow(from) {
		if(channels[from] === undefined) {
			addChannel(from, true);
		}
	}
	
	/**
	 * Output functions
	 */
	function outputNotice(data) {
		// always to log
		var time = new Date(data.time);
		data.text = $("<div />").html(data.text).text();
		// is log active?
		if(active === "log") {
			$(output).append("[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>").scrollTop(output[0].scrollHeight);
		} else {
			channels.log.history += "[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>";
			addChannelHilight("log");
		}
	}
	
	function outputError(data) {
		// always to active window
		var time = new Date(data.time);
		data.text = $("<div />").html(data.text).text();
		$(output).append("[" + time.toLocaleTimeString() + "] -!- " + data.text + "<br/>").scrollTop(output[0].scrollHeight);
	}
	
	function outputSpecific(data, type) {
		var time = new Date(data.time),
		text = "[" + time.toLocaleTimeString() + "] ";
		data.text = $("<div />").html(data.text).text();
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
			channels[data.channel].history += text;
			addChannelHilight(data.channel);
		}
	}
	
	function outputLog(message) {
		var now = new Date();
		$(output).append("[" + now.toLocaleTimeString() + "] * " + message + "<br/>").scrollTop(output[0].scrollHeight);
	}
		
	// ----------------------------------------------
	function outputStatus(msg) {
		$("#status").text(msg);
		clearTimeout(timer);
		timer = setTimeout(function(){
			$("#status").fadeOut(function(){
				$("#status").text("").fadeIn();
			});
		}, 3000);
	}
	
	function sendSocketMsg(msg) {
		if(!websocket || websocket.readyState === 3) {
			console.log("The websocket is not connected to a server.");
		} else {
			websocket.send(msg);
			$("#message").val("");
		}
	}
	
	function clear() {
		output.text("");
		channels = {};
		active = "";
		$("#userList").empty();
		$("#channelList").empty();
		$("#hChannel").empty();
		$("#hTopic").empty();
	}

	// Send a message to the server
	// by button and enterkey
	$("#send_message").on("click", function(e) {
		// send message and active window
		var msg = $("#message").val();
		var channel = $("#channelList").val();
		if(channel.indexOf(":private") > 0) {
			console.log("Sent from private");
			var to = channel.split(":")[0];
			msg = "/msg " + to + " " + msg;
		}
		// send message and active window
		var json = JSON.stringify({
			window: channel,
			msg: msg
		});
		sendSocketMsg(json);
	});	
	$("#message").keydown(function(e) {
		if(e.keyCode === 13) {
			var msg = $(this).val();
			if(!msg) {
				return;
			}
			var channel = $("#channelList").val();
			if(channel.indexOf(":private") > 0) {
				console.log("Sent from private");
				var to = channel.split(":")[0];
				msg = "/msg " + to + " " + msg;
			}
			// send message and active window
			var json = JSON.stringify({
				window: channel,
				msg: msg
			});
			sendSocketMsg(json);
		}
	});
	
	// detect channel change
	$("#channelList").change(function() {
		setActiveChannel($(this).val());
	})

	// Close the connection to the server
	$("#close").on("click", function() {		
		console.log("Closing websocket.");
		websocket.close();
		console.log(websocket);
	});

	console.log("Everything is ready.");
});
