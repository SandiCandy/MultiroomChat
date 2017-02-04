var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

const users = {};
const chatrooms = {};
const admins = {};

//StandardsChats - gibt es immer
chatrooms['Neu bei CoffeeChat'] = { name: 'Neu bei CoffeeChat', public: true, users: {} };
chatrooms['Osnabrück und Umgebung'] = {name: 'Osnabrück und Umgebung', public: true, users: {} };
chatrooms['Studententreff'] = {name: 'Studententreff', public: true, users: {} };
chatrooms['Professorentreff'] = {name: 'Professorentreff', public: false, users: {} };

//Admin-Liste
admins['Barista'] = 'password';


// tell express where to serve static files from
app.use(express.static(__dirname + '/public'));

//Route handling
app.get('/', function (req, res) {
  //Sending Files (Normal User-Interfaces)
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/login', function (req, res) {
  //Sending Files (Admin-Login)
  res.sendFile(__dirname + '/public/login.html');
});

//Listening to the connection-event for incoming sockets
io.on('connection', function(socket){
  console.log('Socket ' + socket.id + ' a user connected');

  //Server receive 'login'-Event with String username
  socket.on('login', function(username) {
    //Checken, ob username schon vergeben ist
    for(let sid in users){
      if(users[sid].username === username) {
        return io.to(socket.id).emit('login-error', username);
      }
    }
    //Checken, ob username einem Admin gehört
    if(admins.hasOwnProperty(username)) {
        return io.to(socket.id).emit('login-error', username);
    }

    var defaultRoom = chatrooms['Neu bei CoffeeChat'];
    var newPerson = {
      username: username,
      room: defaultRoom.name,
      owner: false
    };

    users[socket.id] = newPerson;
    defaultRoom.users[socket.id] = newPerson;

    socket.join(defaultRoom.name);

    //Server sends login-Event to all users in the room with Object person, Array Object.keys(chatrooms), Object defaultRoom
    //person.username - username (String)
    //person.room     - current room (String)
    //person.owner    - for extra features (boolean)
    //
    //Object.keys(chatroom) - contains an array of Strings with all roomnames
    //
    //defaultRoom - current room
    //defaultRoom.name   - roomname
    //defaultRoom.public - boolean
    //defaultRoom.users - Object with all Persons in the room (key: socket.id, value: user-Object)
    io.to(defaultRoom.name).emit('login', newPerson, Object.keys(chatrooms), defaultRoom);

  });

  //Server receive 'login'-Event with String username
  socket.on('admin-login', function(username, pw) {
    console.log('Admin-Login: ' + username + ': ' + pw);
    if(!admins.hasOwnProperty(username) && admins[username] !== pw) {
      return io.to(socket.id).emit('login-error', username);
    }

    //Admin muss in Nutzerliste eingetragen werden
    var defaultRoom = chatrooms['Neu bei CoffeeChat'];
    var newPerson = {
      username: username,
      room: defaultRoom.name,
      owner: true
    };

    users[socket.id] = newPerson;
    defaultRoom.users[socket.id] = newPerson;

    socket.join(defaultRoom.name);
    io.to(defaultRoom.name).emit('login', newPerson, Object.keys(chatrooms), defaultRoom);

  });

  //Server receive 'changeRoom'-Event with String roomname
  socket.on('changeRoom', function(roomname) {
    var sid = socket.id;
    var rname = users[sid].room;
    var oldRoom = chatrooms[rname];
    var existingRoom = false;

    if(chatrooms[roomname]) {
      existingRoom = true;
      if(!chatrooms[roomname].public) {
        //Room ist privat - User kann nicht in den Raum wechseln
        return io.to(sid).emit('chat message', {time: new Date(), message: 'Der gewünschte Raum "' + roomname + '" ist privat.', name: 'INFO'  });
      }
      console.log('User ' + users[sid].username + ' changed to Room "' + roomname + '".');
      users[sid].owner = false;

    }

    if(!existingRoom) {
      chatrooms[roomname] = { name: roomname, public: true, users: {}};
      users[sid].owner = true;
      console.log('Room "' + roomname + '" created!');
    }

    io.to(users[sid].room).emit('chat message', {time: new Date(), message: users[sid].username +' ist in den Raum "' + roomname + '" gewechselt.', name: 'INFO'  });
    socket.leave(users[sid].room);

    //User wird über seine Socket.id aus alter Raumliste entfernt
    delete oldRoom.users[sid];
    delete chatrooms[rname].users[sid];

    // Alte (leere) Räume entfernen
    updateRoomlist(rname);

    users[sid].room = chatrooms[roomname].name;
    chatrooms[roomname].users[sid] = users[sid];

    socket.join(users[sid].room);

    //Server sends login-Event to all users in the room with
    //Object users[sid]             - the person,
    //Array Object.keys(chatrooms)  - all chatrooms,
    //Object chatrooms[roomname]    - the new room

    io.to(roomname).emit('changeRoom', users[sid], Object.keys(chatrooms), chatrooms[roomname]);

  });


  //Server receive 'chat message'-Event with String message from a user
  socket.on('chat message', function(message) {
    var user = users[socket.id];
    var room = chatrooms[user.room];
    if (message.startsWith('/remove ')) {
      if(!user.owner) {
        console.log(user + ' is not a owner and cannot remove other users.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst hier keine Personen entfernen.', name: 'INFO'  });
      }
      var to_remove = message.slice(7).trim();
      for(let sid in room.users) {
        if(user.username === to_remove) {
          return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst dich nicht selber entfernen!', name: 'INFO'  });
        }
        if(room.users[sid].username === to_remove) {
          //TODO: User in Defaultroom werfen 'changeRoom'-Methode
        }
      }
      return io.to(socket.id).emit('chat message', {time: new Date(), message: to_remove + ' wurde nicht gefunden.', name: 'INFO'  });

    }

    if(message === '/lock') {
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
      io.to(roomname).emit('chat message', {time: new Date(), message: user.username + ' hat diesen Raum "' + room.name + '" geschlossen.', name: 'INFO'  });
      return io.to(socket.id).emit('chat message', {time: new Date(), message: room.name + ' ist jetzt privat. Nutze "/unlock", um den Raum wieder öffentlich zu machen.', name: 'INFO'  });

    }

    if(message === '/unlock') {
      let roomname = user.room;
      let room = chatrooms[roomname];
      if(room.public) {
        console.log(user.username + ' cannot lock the room ' + room.name + ' because it is already public.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du befindest dich schon in einem öffentlichen Raum. Um einen Raum privat zu machen, nutze "/lock".', name: 'INFO'  });
      }
      if(!user.owner) {
        console.log(user.username + ' is not a owner and cannot lock the room.');
        return io.to(socket.id).emit('chat message', {time: new Date(), message: 'Du kannst diesen Raum nicht öffentlich machen.', name: 'INFO'  });
      }
      room.public = true;
      io.to(roomname).emit('chat message', {time: new Date(), message: user.username + ' hat diesen Raum "' + room.name + '" öffentlich gemacht.', name: 'INFO'  });
      return io.to(socket.id).emit('chat message', {time: new Date(), message: room.name + ' ist jetzt öffentlich. Nutze "/lock", um den Raum wieder privat zu machen.', name: 'INFO'  });

    }

    if(message === '/info') {
      //TODO
    }

    console.log('[' + user.room + '] message: ' + message + ' from ' + user.username);
    io.to(user.room).emit('chat message', {time: new Date(), message: message, name: user.username || 'Anonym'  });
  });

  ///Server receive 'user image'-Event with data (base64 file) from a user
  socket.on('user image', function (data) {
    var user = users[socket.id];
    console.log('Received base64 file from ' + user.username);
    //Received an image: broadcast to all in a room
    io.to(user.room).emit('user image', {time: new Date(), message: data, name: user.username || 'Anonym'  });
});

  //Each socket also fires a special disconnect event
  //Andere Chatuser erhalten die Nachricht, dass Nutzer den Raum verlassen hat
  //Austragen aus Nutzerliste
  //Raum löschen, wenn leer
  //Update der Nutzerliste ?
  socket.on('disconnect', function(data){
    let user = users[socket.id];
    if(user) {
      console.log(socket.id + ' :User ' + user.username + 'left the chat.');
      var roomname = user.room;
      delete chatrooms[roomname].users[socket.id];
      updateRoomlist(roomname);
      io.to(user.room).emit('chat message', {time: new Date(), message: user.username +' hat den Chat verlassen.', name: 'INFO'  });
      delete users[socket.id];
    }
  });


}); //io.on(connection)-Ende

http.listen(conf.port, function() {
  console.log('listening on *:' + conf.port);
});

// Prüfe, ob ein Raum leer ist und gelöscht werden darf
var updateRoomlist = function(roomname) {
  let room = chatrooms[roomname];
  if(Object.keys(room.users).length === 0 && roomname !== 'Neu bei CoffeeChat' && roomname !== 'Osnabrück und Umgebung' && roomname !== 'Professorentreff' && roomname !== 'Studententreff') {
    console.log(roomname + ' was empty. DELETED.');
    delete chatrooms[roomname];
  }
};
