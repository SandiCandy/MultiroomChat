var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

const users = {};
const chatrooms = {};

//StandardsChats - gibt es immer
chatrooms['Neu bei CoffeeChat'] = { name: 'Neu bei CoffeeChat', public: true, users: {} };
chatrooms['Osnabrück und Umgebung'] = {name: 'Osnabrück und Umgebung', public: true, users: {} };
chatrooms['Studententreff'] = {name: 'Studententreff', public: true, users: {} };
chatrooms['Professorentreff'] = {name: 'Professorentreff', public: false, users: {} };

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
    var defaultRoom = chatrooms['Neu bei CoffeeChat'];
    var newPerson = {
      username: username,
      room: defaultRoom.name,
      owner: false
    };

    users[socket.id] = newPerson;
    defaultRoom.users[socket.id] = newPerson;

    socket.join(defaultRoom.name);
    io.to(defaultRoom.name).emit('login', newPerson, Object.keys(chatrooms), defaultRoom);

  });

  socket.on('changeRoom', function(roomname) {
    //TODO: Alte Räume entfernen
    var sid = socket.id;
    var oldRoom = users[sid].room;
    var existingRoom = false;

    if(chatrooms[roomname]) {
      existingRoom = true;
      if(!chatrooms[roomname].public) {
        //Room ist privat - User kann nicht in den Raum wechseln
        return io.to(sid).emit('chat message', {time: new Date(), message: 'Der gewünschte Raum "' + roomname + '" ist privat.', name: 'INFO'  });
      }
      console.log('User ' + users[sid].username + ' changed to Room "' + roomname + '".')
      users[sid].owner = false;

    }

    if(!existingRoom) {
      chatrooms[roomname] = { name: roomname, public: true, users: {}};
      users[sid].owner = true;
      console.log('Room "' + roomname + '" created!')
    }

    io.to(users[sid].room).emit('chat message', {time: new Date(), message: users[sid].username +' ist in den Raum "' + roomname + '" gewechselt.', name: 'INFO'  });
    socket.leave(users[sid].room);

    //User wird über seine Socket.id aus alter Raumliste entfernt
    //TODO: Weitere "Leichen" prüfen und ggf. entfernen?
    delete chatrooms[oldRoom].users[sid];

    users[sid].room = chatrooms[roomname].name;
    chatrooms[roomname].users[sid] = users[sid];

    socket.join(users[sid].room);
    io.to(roomname).emit('changeRoom', users[sid], Object.keys(chatrooms), chatrooms[roomname]);

  });


  //Server receive 'chat message'-Event from a user
  socket.on('chat message', function(data) {
    var user = users[socket.id];
    //var usersInRoom = user.room.users;
    if (data.message.startsWith('/remove ')) {
      if(!user.owner) {
        console.log(user + ' is not a owner and cannot remove other users.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst hier keine Personen entfernen.', name: 'INFO'  });
      }
      var to_remove = data.message.slice(7);
      return io.to(socket.id).emit('chat message', {time: new Date(), message: to_remove + ' wurde nicht gefunden.', name: 'INFO'  });
      //TODO: Durchsuchen, ob User mit dem Namen im Raum ist

    }

    if(data.message === '/lock') {
      var roomname = user.room;
      var room = chatrooms[roomname];
      if(!room.public) {
        console.log(user.username + ' cannot lock the room ' + room.name + ' because it is already private.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du befindest dich schon in einem privaten Raum. Um einen Raum öffentlich zu machen, nutze "/unlock".', name: 'INFO'  });
      }
      if(!user.owner) {
        console.log(user.username + ' is not a owner and cannot lock the room.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst diesen Raum nicht privat machen.', name: 'INFO'  });
      }
      room.public = false;
      return io.to(socket.id).emit('chat message', {time: new Date(), message: room.name + ' ist jetzt privat. Nutze "/unlock", um den Raum wieder öffentlich zu machen.', name: 'INFO'  });

    }

    if(data.message === '/unlock') {
      var roomname = user.room;
      var room = chatrooms[roomname];
      if(room.public) {
        console.log(user.username + ' cannot lock the room ' + room.name + ' because it is already public.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du befindest dich schon in einem öffentlichen Raum. Um einen Raum privat zu machen, nutze "/lock".', name: 'INFO'  });
      }
      if(!user.owner) {
        console.log(user.username + ' is not a owner and cannot lock the room.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst diesen Raum nicht öffentlich machen.', name: 'INFO'  });
      }
      room.public = true;
      return io.to(socket.id).emit('chat message', {time: new Date(), message: room.name + ' ist jetzt öffentlich. Nutze "/lock", um den Raum wieder privat zu machen.', name: 'INFO'  });

    }

    if(data.message === '/info') {
      //TODO
    }

    console.log('[' + user.room + '] message: ' + data.message + ' from ' + user.username);
    io.to(user.room).emit('chat message', {time: new Date(), message: data.message, name: user.username || 'Anonym'  });
  });

  socket.on('user image', function (data) {
    let user = users[socket.id];
    console.log('Received base64 file from ' + user.username);
    //Received an image: broadcast to all in a room
    io.to(user.room).emit('user image', {time: new Date(), message: data, name: user.username || 'Anonym'  });
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
