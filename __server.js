var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

var users = new Map;
var rooms = new Map;

//StandardsChat - gibt es immer, auch wenn diese leer sind
//TODO: Weitere Daten? Owner? Anzahl der Personen?
rooms.set('Neu bei CoffeeChat', {public: true});
rooms.set('Osnabrück und Umgebung', {public: true});
rooms.set('Studententreff', {public: true});
rooms.set('Professorentreff', {public: true});


// tell express where to serve static files from
app.use(express.static(__dirname + '/public'));

//Route handling
app.get('/', function (req, res) {
  //Sending Files
  res.sendFile(__dirname + '/public/index.html');
});

//Listening to the connection-event for incoming sockets
io.on('connection', function(socket){
  console.log('Socket ' + socket.id + ': A user connected');

  socket.on('login', function(username){
      var defaultRoom = rooms.get('Neu bei CoffeeChat');
      //TODO: Checken, ob Username schon vergeben

      //User der Map 'users' zufügen
      users.set(socket.id, {
        username: username,
        room: defaultRoom
      });

      socket.join(defaultRoom);
      io.to(defaultRoom).emit('login', newPerson, rooms);
    }
  });

  socket.on('changeRoom', function(user, room) {

  });

  socket.on('sendMessage', function(data){

  });

  socket.on("typing", function(data) {
    if (typeof people[socket.id] !== "undefined") {
      io.sockets.in(socket.room).emit("isTyping", {isTyping: data, person: people[socket.id].name});
    }
  });

  //Each socket also fires a special disconnect event
  socket.on('disconnect', function(){
    //TODO: Welcher User verlässt den chat?
    console.log('user disconnected');
    io.emit('logout message');
  });

}); // io.on(connection)-Ende

http.listen(conf.port, function() {
  console.log('listening on *:' + conf.port);
});
