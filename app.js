var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

const users = {}
const rooms = [];

// var chatrooms = new Map();
// chatrooms.set('Neu bei CoffeeChat', {name: 'Neu bei CoffeeChat', public: true, users: [] });
// chatrooms.set('Osnabrück und Umgebung', {name: 'Osnabrück und Umgebung', public: true, users: [] });
// chatrooms.set('Studententreff', {name: 'Studententreff', public: true, users: []});
// chatrooms.set('Professorentreff', {name: 'Professorentreff', public: false, users: []});


const chatrooms = {};

chatrooms['Neu bei CoffeeChat'] = { name: 'Neu bei CoffeeChat', public: true, users: [] };
chatrooms['Osnabrück und Umgebung'] = {name: 'Osnabrück und Umgebung', public: true, users: [] };
chatrooms['Studententreff'] = {name: 'Studententreff', public: true, users: []};
chatrooms['Professorentreff'] = {name: 'Professorentreff', public: false, users: []};



//StandardsChats - gibt es immer
rooms.push({name: "Neu bei CoffeeChat", public: true, users: {} });
rooms.push({name: "Osnabrück und Umgebung", public: true, users: {}});
rooms.push({name: "Studententreff", public: true, users: {}});
rooms.push({name: "Professorentreff", public: false, users: {} });

// tell express where to serve static files from
app.use(express.static(__dirname + '/public'));

//Route handling
app.get('/', function (req, res) {
  //Sending Files
  res.sendFile(__dirname + '/public/index.html');
});

//Listening to the connection-event for incoming sockets
io.on('connection', function(socket){
  console.log('Socket ' + socket.id + ' a user connected');

  socket.on('login', function(username) {
    var defaultRoom = rooms[0].name;
    defaultRoom = 'Neu bei CoffeeChat';
    var newPerson = {
      username: username,
      room: chatrooms[defaultRoom],
      //room: rooms[0],
      owner: false
    };

    users[socket.id] = newPerson;
    chatrooms[defaultRoom].users.push(socket.id);

    socket.join(defaultRoom);
    io.to(defaultRoom).emit('login', newPerson, chatrooms);

  });

  socket.on('changeRoom', function(roomname) {
    var sid = socket.id;
    var oldRoom = users[sid].room;
    var existingRoom = false;

    if(chatrooms[roomname]) {
      existingRoom = true;
      if(!chatrooms[roomname].public) {
        console.log('Room is private!');
        return io.to(sid).emit('chat message', {time: new Date(), message: 'Der gewünschte Raum "' + roomname + '" privat.', name: 'INFO'  });
      }
      console.log('User ' + users[sid].username + ' changed to Room "' + roomname + '".')
      users[sid].owner = false;

    }

    if(!existingRoom) {
      rooms.push({name: roomname, public: true, users: {} });
      chatrooms[roomname] = { name: roomname, public: true, users: []};
      users[sid].owner = true;
      console.log('Room "' + roomname + '" created!')
    }

    io.to(users[sid].room.name).emit('chat message', {time: new Date(), message: users[sid].username +' ist in den Raum "' + roomname + '" gewechselt.', name: 'INFO'  });
    socket.leave(users[sid].room.name);

    //User wird über seine Socket.id aus alter Raumliste entfernt
    //TODO: Weitere "Leichen" prüfen und ggf. entfernen?
    var i = chatrooms[oldRoom.name].users.indexOf(sid);
    if(i !== -1) {
      chatrooms[oldRoom.name].users.splice(i, 1);
    }

    users[sid].room = chatrooms[roomname];
    chatrooms[roomname].users.push(sid);

    socket.join(users[sid].room.name);
    io.to(roomname).emit('changeRoom', users[sid], chatrooms);

    console.log(chatrooms);

  });


  //Server receive 'chat message'-Event from a user
  socket.on('chat message', function(data) {
    var user = users[socket.id];
    if (data.message.startsWith('/remove ')) {
      if(!user.owner) {
        console.log(user + ' is not a owner and cannot remove other users.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst hier keine Personen entfernen.', name: 'INFO'  });
      }
      var to_remove = data.message.slice(7);
      return io.to(socket.id).emit('chat message', {time: new Date(), message: to_remove + ' wurde nicht gefunden.', name: 'INFO'  });
      //TODO: Durchsuchen, ob User mit dem Namen im Raum ist
    }

    console.log('[' + user.room.name + '] message: ' + data.message + ' from ' + user.username);
    io.to(user.room.name).emit('chat message', {time: new Date(), message: data.message, name: user.username || 'Anonym'  });
  });

  socket.on('user image', function (data) {
    let user = users[socket.id];
    console.log('Received base64 file from ' + user.username);
    //Received an image: broadcast to all in a room
    io.to(user.room.name).emit('user image', {time: new Date(), message: data, name: user.username || 'Anonym'  });
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
