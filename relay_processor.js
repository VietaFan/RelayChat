exports.users = [];
var users = exports.users;
var attr = {};
var adminPassword = "FN2187";
var contest = {problems: [], startTime: 0, roundStage: 0, round: 0, scoredRound: 0, submissions: {}, three_mins: {}, isRunning: false, scores: {}, leaderboard: []};
var roundDeltas = [-180, -60, -15, 0, 165, 180, 345, 360, 1000000000];
var teams = {};
var invNameMap = {};

function resetContest() {
	contest.startTime = 0;
	contest.roundStage = 0;
	contest.isRunning = false;
}
function autoMessage(io) {
	if (contest.startTime == 0)
		return;
	var dt = parseInt((new Date().getTime()-contest.startTime)/1000);
	while (dt > roundDeltas[contest.roundStage]+3)
		contest.roundStage++;
	if (dt < roundDeltas[contest.roundStage])
		return;
	switch (contest.roundStage) {
		case 0:
			io.emit('msg', 'The next round starts in 3 minutes.');
			break;
		case 1:
			io.emit('msg', 'The next round starts in 1 minute.');
			break;
		case 2:
			io.emit('msg', 'The next round starts in 15 seconds.');
			for (var i=0; i<users.length; ++i) {
				var user_attr = attr[users[i]];
				if (user_attr != undefined && user_attr.team != undefined && user_attr.position != undefined) {
					io.to(users[i]).emit('msg', 'You are in position ' + user_attr.position + ' on team ' + user_attr.team + '.');
				}
			}
			break;
		case 3:
			io.emit('msg', 'Round is starting!');
			for (team in teams) {
				if (contest.submissions[team] == undefined) {
					contest.submissions[team] = [];
					contest.three_mins[team] = [];
				}				
				contest.submissions[team][contest.round] = ["none", "none", "none", "none"];
				contest.three_mins[team][contest.round] = false;
				for (var k=1; k<4; ++k) {
					if (teams[team][k] != undefined) {
						io.to(invNameMap[teams[team][k]]).emit('msg', '/clear');
						io.to(invNameMap[teams[team][k]]).emit('msg', contest.problems[k+3*contest.round]);
					}
				}
			}
			contest.isRunning = true;
			break;
		case 4:
			io.emit('msg', '15 seconds left to submit 3 minute answers!');
			break;
		case 5:
			io.emit('msg', '3 minutes are up!');
			break;
		case 6:
			io.emit('msg', '15 seconds left to submit 6 minute answers!');
			break;
		case 7:
			io.emit('msg', '6 minutes are up!');
			for (i in users) {
				var x = users[i];
				console.log(x);
				console.log(attr[x]);
				if (attr[x] != undefined && attr[x].admin === true) {
					for (t in teams) {
						console.log(t);
						var res_str = 'Team: ' + t + "; answer: " + contest.submissions[t][contest.round][3] + "; time: ";
						if (contest.three_mins[t][contest.round]) {
							res_str += "3 minutes";
						} else {
							res_str += "6 minutes";
						}
						io.to(x).emit('msg', res_str);
					}
				}
			}
			for (var i=0; i<users.length; ++i) {
				if (attr[users[i]].team != undefined) {
					var team_ans = "";
					for (var j=1; j<4; ++j) {
						team_ans += j+". "+contest.submissions[attr[users[i]].team][contest.round][j];
						if (j < 3)
							team_ans += ", ";
					}
					io.to(users[i]).emit('Your team\'s answers: '+team_ans);
				}
			}
			contest.isRunning = false;
			break;
	}
	contest.roundStage++;
}

exports.initMessages = function (io) {	
	setInterval(autoMessage, 1000, io);
}

exports.process = function(msg, io, userID){
	if (attr[userID] === undefined) {
		attr[userID] = {};
	}
	var sendTo = function(user, message) {
		io.to(user).emit('msg', message);
	};
	var sendSelf = function(message) {
		io.to(userID).emit('msg', message);
	};
	var sendAll = function(message) {
		io.emit('msg', message);
	};
	var addUser = function(user) {
		io.emit('user_add', user);
	};
	var removeUser = function(user) {
		io.emit('user_remove', user);
	}
	if (msg === "/clear") {
		sendSelf("/clear");
		return;
	}
	var splitMsg = msg.split(" ");
	if (attr[userID].name === undefined) {
		var myName = 'Anonymous';
	} else {
		var myName = attr[userID].name;
	}
	var reqAdmin = function() {
		if (attr[userID].admin !== true) {
			sendSelf('Sorry, you need administrator privileges to run this command.');
			return false;
		}
		return true;
	}
	switch (splitMsg[0]) {
		case "/setname":
			sendSelf(msg);
			if (invNameMap[splitMsg[1]] != undefined) {
				sendSelf("Sorry, that name already exists. Please choose another name.");
				return;
			}
			if (attr[userID].name != undefined) {
				removeUser(attr[userID].name);
			}
			sendSelf('Setting your username to ' + splitMsg[1] +'.');
			addUser(splitMsg[1]);
			attr[userID].name = splitMsg[1];
			invNameMap[splitMsg[1]] = userID;
			break;
		case "/admin":
			if (splitMsg[1] == adminPassword) {
				sendSelf(msg);
				sendSelf(myName+', you are now an admin.');
				attr[userID].admin = true;
			} else {
				sendSelf(msg);
				sendSelf('Sorry, that is not the correct admin password.');
			}
			break;
		case "/setprob":
			sendSelf(msg);
			if (!reqAdmin()) return;
			var number = parseInt(splitMsg[1]);
			contest.problems[number] = splitMsg[2];
			for (var i=3; i<splitMsg.length; ++i) {
				contest.problems[number] += ' '+splitMsg[i];
			}
			sendSelf('Updated problem statement.');
			break;
		case "/startin":
			sendSelf(msg);
			if (!reqAdmin()) return;
			var dt = parseInt(splitMsg[1]);
			resetContest();
			contest.startTime = new Date().getTime()+1000*dt;
			sendAll('The contest will start in ' + Math.floor(dt/60) + " minutes, " + (dt%60) + " seconds.");
			break;
		case "/time":
			sendSelf(msg);
			var startTime = contest.startTime;
			var currentTime = new Date().getTime();
			if (startTime == 0) {
				sendSelf('The starting time has not been scheduled.');
			} else if (startTime > currentTime) {
				var dt = Math.floor(startTime - currentTime)/1000;
				sendSelf('The contest will start in ' + Math.floor(dt/60) + " minutes, " + Math.floor(dt%60) + " seconds.");
			} else {
				var dt = Math.floor(startTime + 360000 - currentTime)/1000;
				sendSelf('There are ' + Math.floor(dt/60) + " minutes and " + Math.floor(dt%60) + " seconds remaining in the contest.");
			}
			break;
		case "/create":
			if (contest.isRunning) {
				sendSelf(msg);
				sendSelf('Sorry, you cannot create a team while a round is in progress.');
				return;
			}
			sendAll(myName+': '+msg);
			if (splitMsg.length != 2) {
				sendAll('Error: you must specify a team name with no spaces.');
				return;
			}
			if (teams[splitMsg[1]] != undefined) {
				sendAll('Error: There is already a team called \''+splitMsg[1]+'\'.');
				return;
			}
			sendAll('Team ' + splitMsg[1] + ' created.');
			teams[splitMsg[1]] = [];
			break;
		case "/join":
			if (contest.isRunning) {
				sendSelf(msg);
				sendSelf('Sorry, you cannot join a team while a round is in progress.');
				return;
			}
			sendAll(myName+': '+msg);
			if (myName == "Anonymous") {
				sendAll("Error: You must specify a username before you can join a team.");
				return;
			}
			if (splitMsg.length != 3 || ([1,2,3].indexOf(parseInt(splitMsg[2])) == -1)) {
				sendAll('Error: syntax: "/join teamName positionNumber"');
				return;
			}
			if (teams[splitMsg[1]] == undefined) {
				sendAll('Error: team \'' + splitMsg[1] + '\' does not exist.');
				return;
			}
			teams[splitMsg[1]][parseInt(splitMsg[2])] = myName;
			attr[userID].team = splitMsg[1];
			attr[userID].position = parseInt(splitMsg[2]);
			sendAll("Added " + myName + " to team " + splitMsg[1] + " in position " + splitMsg[2] + ".");
			break;
		case "/showteams":
			sendSelf(msg);
			for (team in teams) {
				var teamStr = team + ":";
				for (var pos = 1; pos < 4; ++pos) {
					teamStr += " " + pos + ". ";
					if (teams[team][pos] === undefined) {
						teamStr += "(spot available)";
					} else {
						teamStr += teams[team][pos];
					}
				}
				sendSelf(teamStr);
			}
			break;
		case "/pass":
			sendSelf(msg);
			var dt = new Date().getTime() - contest.startTime;
			if (!contest.isRunning) {
				sendSelf('Sorry, no round is going on right now.');
				break;
			}
			if (attr[userID].team == undefined) {
				sendSelf('Sorry, you have to be on a team to pass an answer.');
				break;
			}
			if (attr[userID].position == 3) {
				sendSelf('You\'re in the third position, so you don\'t have anyone to pass an answer back to. To submit your answer, use the /submit command.');
				break;
			}
			var ansStr = splitMsg[1];
			for (var i=2; i<splitMsg.length; ++i) {
				ansStr += ' '+splitMsg[i];
			}
			if (contest.submissions[attr[userID].team] == undefined) {
				contest.submissions[attr[userID].team] = {};				
			}
			if (contest.submissions[attr[userID].team][contest.round] == undefined) {
				contest.submissions[attr[userID].team][contest.round] = [];
			}
			contest.submissions[attr[userID].team][contest.round][attr[userID].position] = ansStr;
			sendSelf('You have passed back ' + ansStr + ' to ' + teams[attr[userID].team][attr[userID].position+1] + '.');
			sendTo(invNameMap[teams[attr[userID].team][attr[userID].position+1]], myName + ' has passed you ' + ansStr + '.');
			break;
		case "/submit":
			sendSelf(msg);
			var dt = new Date().getTime() - contest.startTime;
			if (dt < 0 || dt > 360000) {
				sendSelf('Sorry, no round is going on right now.');
				break;
			}
			if (attr[userID].team == undefined) {
				sendSelf('Sorry, you have to be on a team to submit an answer.');
				break;
			}
			if (attr[userID].position != 3) {
				sendSelf('You\'re not in the third position, so your teammate will submit your team\'s answer. Please pass your answer back with /pass.');
				break;
			}
			var ansStr = splitMsg[1];
			for (var i=2; i<splitMsg.length; ++i) {
				ansStr += ' '+splitMsg[i];
			}			
			if (contest.submissions[attr[userID].team] == undefined) {
				contest.submissions[attr[userID].team] = {};				
			}
			if (contest.submissions[attr[userID].team][contest.round] == undefined) {
				contest.submissions[attr[userID].team][contest.round] = [];
			}
			contest.submissions[attr[userID].team][contest.round][attr[userID].position] = ansStr;
			sendSelf('You have submitted ' + ansStr + ' as your team\'s ' + ((dt < 180000) ? '3' : '6') + ' minute answer.');
			if (contest.three_mins[attr[userID].team] == undefined) {
				contest.three_mins[attr[userID].team] = {};
			}
			contest.three_mins[attr[userID].team][contest.round] = (dt < 180000);
			break;
		case "/givepoints":
			if (!reqAdmin()) return;
			var team = splitMsg[1];
			var score = parseInt(splitMsg[2]);
			if (contest.scores[team] == undefined) {
				contest.scores[team] = [];
			}
			while (contest.scores[team].length <= contest.round) {
				contest.scores[team].push(0);
			}
			contest.scores[team][contest.round] = score;
			break;
		case "/release-scores":
			if (!reqAdmin()) return;
			sendAll("Scores for round "+contest.round+":");
			var L = [];
			for (team in teams) {
				L.push([team, contest.scores[team][contest.round]]);
			}
			var compFunc = function(a,b) {
				if (a[1] != b[1]) {
					return b[1]-a[1];
				} else {
					if (a[0] < b[0]) {
						return -1;
					} else if (a[0] === b[0]) {
						return 0;
					} else {
						return 1;
					}
				}
			};
			L.sort(compFunc);
			for (var i=0; i<L.length; ++i) {
				sendAll(L[i][0]+": "+L[i][1]);
			}
			contest.scoredRound += 1;
			contest.leaderboard = [];
			for (team in teams) {
				contest.leaderboard.push([team, 0]);
			}
			for (var i=0; i<contest.leaderboard.length; ++i) {
				var team = contest.leaderboard[i][0];
				for (var j=0; j<contest.scoredRound; ++j) {
					contest.leaderboard[i][1] += contest.scores[team][j];
				}
			}
			contest.leaderboard.sort(compFunc);
			sendAll("Full leaderboard (Rounds 1-"+contest.scoredRound+"):");
			for (var i=0; i<contest.leaderboard.length; ++i) {
				sendAll(contest.leaderboard[i][0]+": "+contest.leaderboard[i][1]);
			}
			break;
		case "/leaderboard":
			if (contest.scoredRound == 0) {
				sendSelf("The leaderboard isn\'t ready, since no rounds of the contest have happened yet.");
				break;
			}
			sendSelf("Full leaderboard (Rounds 1-"+contest.scoredRound+"):");
			for (var i=0; i<contest.leaderboard.length; ++i) {
				sendSelf(contest.leaderboard[i][0]+": "+contest.leaderboard[i][1]);
			}
		default:
			if (!reqAdmin() && contest.isRunning) {
				sendSelf(msg);
				sendSelf('Sorry, a round is currently in progress, so you need admin priviliges to send a message.');
				break;
			}
			sendAll(myName+': '+msg);			
	}
}

exports.init_user = function(io, id) {
	attr[users[users.length-1]] = {name: "Anonymous"+users.length};
	for (var i=0; i<users.length; ++i) {
		io.to(id).emit('user_add', attr[users[i]].name);
	}
};