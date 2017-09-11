var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var processor = require('./relay_processor');
var users = processor.users;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

processor.initMessages(io);

io.on('connection', function(socket){
  users.push(socket.id);
  processor.init_user(io, socket.id);
  socket.on('msg', function(msg){
	  processor.process(msg, io, socket.id);
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
