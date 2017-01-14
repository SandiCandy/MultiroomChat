var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

//var users = [];
var users = {}
var rooms = [];

//StandardsChats - gibt es immer
rooms.push({name: "Neu bei CoffeeChat", public: true});
rooms.push({name: "Osnabrück und Umgebung", public: true});
rooms.push({name: "Studententreff", public: true});
rooms.push({name: "Professorentreff", public: true});

// tell express where to serve static files from
app.use(express.static(__dirname + '/public'));

//Route handling
app.get('/', function (req, res) {
  //Sending Files
  res.sendFile(__dirname + '/public/index.html');
});

//Listening to the connection-event for incoming sockets
io.on('connection', function(socket){
  console.log('Socket ' + socket.id + 'a user connected');

  socket.on('login', function(username) {
    var defaultRoom = rooms[0];
    var newPerson = {
      username: username,
      room: defaultRoom
    };

    let sid = socket.id;

    users[sid] = newPerson;

    socket.join(defaultRoom.name);
    io.to(defaultRoom.name).emit('login', newPerson, rooms);
  });

  socket.on('changeRoom', function(roomname) {
    let sid = socket.id;
    console.log('User ' + users[sid].username + ' changed to Room "' + roomname + '".')
    let existingRoom = false;
    for(let i=0; i<rooms.length; ++i) {
      if(roomname === rooms[i].name) {
        existingRoom = true;
      }
    }

    if(!existingRoom) {
      rooms.push({name: roomname, public: true});
      console.log('Room "' + roomname + '" created!')
    }

    io.to(users[sid].room.name).emit('chat message', {time: new Date(), message: users[sid].username +' hat den Raum verlassen.', name: 'INFO'  });

    socket.leave(users[sid].room.name);
    for(let i=0; i<rooms.length; ++i) {
      if(rooms[i].name === roomname) {
        users[sid].room = rooms[i];
      }
    }
    socket.join(users[sid].room.name);
    io.to(roomname).emit('changeRoom', users[sid], rooms);

  });


  //Server receive 'chat message'-Event from a user
  socket.on('chat message', function(data) {
    let user = users[socket.id];
    console.log('[' + user.room.name + '] message: ' + data.message + ' from ' + user.username);
    io.to(user.room.name).emit('chat message', {time: new Date(), message: data.message, name: user.username || 'Anonym'  });
  });

  //Each socket also fires a special disconnect event
  socket.on('disconnect', function(data){
    //TODO: Welcher User verlässt den chat?
    console.log('user disconnected', data);
    io.emit('logout message');
  });


}); //io.on(connection)-Ende

http.listen(conf.port, function() {
  console.log('listening on *:' + conf.port);
});
