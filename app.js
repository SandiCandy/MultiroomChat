//Abhängigkeiten von Modulen
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

// Server that integrates the Node.js HTTP-Server
var io = require('socket.io')(http);

//Config-File einbinden
//Enthält nebem dem Port auch die Standardräume und alle verwendeten Events
var conf = require('./config.json');

//Zum Ausgeben eines Logfiles
var fs = require('fs');
var stream = fs.createWriteStream('./logfile.log', {flags: 'a'});

//Objecte zum Speichern der Userdaten
const users = {};
const chatrooms = {};
const admins = {};

//Starten des Servers
http.listen(conf.port, function() {
  stream.write(new Date() + ': CoffeeChat-Server gestartet on Port'  + conf.port + '\n');
  console.log('listening on *:' + conf.port);
  console.log('Chaträume werden konfiguriert...');
  var rooms = conf.rooms;
  for(var key in rooms) {
    chatrooms[rooms[key].name] = {
      name: rooms[key].name,
      public: rooms[key].public,
      users: {}
    };
  }

  console.log('Willkommen bei CoffeeChat!');
});

//Admin-Liste
admins['Barista'] = 'password';
admins['Chef'] = 'pw';
admins['Kellner'] = 'passw0rd';

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
  stream.write(new Date() + ': Ein neue Socketverbindung wurde aufgebaut.\n');

  //Server receive 'login'-Event with String username
  socket.on(conf.command.login, function(username) {
    //Checken, ob username schon vergeben ist
    for(var sid in users){
      if(users[sid].username === username) {
        return io.to(socket.id).emit(conf.command.loginError, username);
      }
    }
    //Checken, ob username einem Admin gehört
    if(admins.hasOwnProperty(username)) {
        return io.to(socket.id).emit(conf.command.loginError, username);
    }

    var defaultRoom = chatrooms[conf.rooms.defaultChat.name];
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
    //Object.keys(chatroom) - contains an array of Strings with all roomnames with
      //defaultRoom - current room
      //defaultRoom.name   - roomname
      //defaultRoom.public - boolean
      //defaultRoom.users - Object with all Persons in the room (key: socket.id, value: user-Object)
    io.to(defaultRoom.name).emit(conf.command.login, newPerson, Object.keys(chatrooms), defaultRoom);
    stream.write(new Date() + ': Ein neuer Nutzer hat sich unter den Namen ' + username + ' erfolgreich eingeloggt.\n');
  });

  //Server receive 'admin-login'-Event with String username
  socket.on(conf.command.adminLogin, function(username, pw) {
    console.log('Admin-Login: ' + username + ': ' + pw);
    if(!admins.hasOwnProperty(username) || admins[username] !== pw) {
      return io.to(socket.id).emit(conf.command.loginError, username);
    }

    //Admin muss in Nutzerliste eingetragen werden
    var defaultRoom = chatrooms[conf.rooms.defaultChat.name];
    var newPerson = {
      username: username,
      room: defaultRoom.name,
      owner: true
    };

    users[socket.id] = newPerson;
    defaultRoom.users[socket.id] = newPerson;

    socket.join(defaultRoom.name);
    io.to(defaultRoom.name).emit(conf.command.login, newPerson, Object.keys(chatrooms), defaultRoom);
    stream.write('Der Administrator ' + username + ' hat den Chat betreten.\n');
  });

  //Server receive 'change-room'-Event with String roomname
  socket.on(conf.command.changeRoom, function(roomname) {

    changeChatroom(roomname, socket);
    stream.write(new Date() + ': Der User ' + users[socket.id].username + ' ist in den Chatraum ' + roomname + ' gewechselt.\n');
  });


  //Server receive 'chatmessage'-Event with String message from a user
  socket.on(conf.command.chatmessage, function(message) {
    var user = users[socket.id];
    var room;
    if(user) {
        room = chatrooms[user.room];
        if(message.startsWith('/')) {
          // Special commands
          return handleChatcommand(message, socket);
        }
        console.log('[' + user.room + '] message: ' + message + ' from ' + user.username);
        io.to(user.room).emit(conf.command.chatmessage, {time: new Date(), message: message, name: user.username || 'Anonym'  });
        stream.write(new Date() + ': Im Raum ' + user.room + ' hat der User ' + user.username + ' eine Nachricht versendet!.\n');

    }
  });

  ///Server receive 'user-image'-Event with data (base64 file) from a user
  socket.on(conf.command.userImage, function (data) {
    var user = users[socket.id];
    console.log('Received base64 file from ' + user.username);
    //Received an image: broadcast to all in a room
    io.to(user.room).emit(conf.command.userImage, {time: new Date(), message: data, name: user.username || 'Anonym'  });
    stream.write(new Date() + ': Im Raum ' + user.room + ' hat der User ' + user.username+ ' ein Bild versendet!.\n');
});

  //Each socket also fires a special disconnect event
  //Andere Chatuser erhalten die Nachricht, dass Nutzer den Raum verlassen hat
  //Austragen aus Nutzerliste
  //Raum löschen, wenn leer
  socket.on('disconnect', function(){
    var user = users[socket.id];
    if(user) {
      console.log(socket.id + ' :User ' + user.username + 'left the chat.');
      stream.write(new Date() + ': Der User mit dem Namen ' + user.username + ' hat den Chat verlassen.\n');
      var roomname = user.room;
      delete chatrooms[roomname].users[socket.id];
      updateRoomlist(roomname);
      io.to(user.room).emit(conf.command.chatmessage, {time: new Date(), message: user.username +' hat den Chat verlassen.', name: 'INFO'  });
      delete users[socket.id];
    }
  });
}); //io.on(connection)-Ende

// Prüfe, ob ein Raum leer ist und gelöscht werden darf
var updateRoomlist = function(roomname) {
  var room = chatrooms[roomname];
  if(Object.keys(room.users).length === 0 && roomname !== 'Neu bei CoffeeChat' && roomname !== 'Osnabrück und Umgebung' && roomname !== 'Professorentreff' && roomname !== 'Studententreff') {
    console.log(roomname + ' was empty. DELETED.');
    delete chatrooms[roomname];
  }
};

// Sonderbefehle bearbeiten
var handleChatcommand = function(message, socket) {
  var user = users[socket.id];
  var room = chatrooms[user.room];

  if(message === '/lock') {
    if(!room.public) {
      console.log('[' + user.room + '] ' + user.username + ' cannot lock the room ' + room.name + ' because it is already private.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du befindest dich schon in einem privaten Raum. Um einen Raum öffentlich zu machen, nutze "/unlock".', name: 'INFO'  });
    }
    if(!user.owner) {
      console.log('[' + user.room + '] ' + user.username + ' is not a owner and cannot lock the room.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst diesen Raum nicht privat machen.', name: 'INFO'  });
    }
    room.public = false;
    io.to(room.name).emit(conf.command.chatmessage, {time: new Date(), message: user.username + ' hat diesen Raum "' + room.name + '" geschlossen.', name: 'INFO'  });
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: room.name + ' ist jetzt privat. Nutze "/unlock", um den Raum wieder öffentlich zu machen.', name: 'INFO'  });

  }

  if(message === '/unlock') {
    if(room.public) {
      console.log('[' + user.room + '] ' + user.username + ' cannot lock the room ' + room.name + ' because it is already public.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du befindest dich schon in einem öffentlichen Raum. Um einen Raum privat zu machen, nutze "/lock".', name: 'INFO'  });
    }
    if(!user.owner) {
      console.log(user.username + ' is not a owner and cannot lock the room.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst diesen Raum nicht öffentlich machen.', name: 'INFO'  });
    }
    room.public = true;
    io.to(room.name).emit(conf.command.chatmessage, {time: new Date(), message: user.username + ' hat diesen Raum "' + room.name + '" öffentlich gemacht.', name: 'INFO'  });
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: room.name + ' ist jetzt öffentlich. Nutze "/lock", um den Raum wieder privat zu machen.', name: 'INFO'  });

  }

  if(message === '/help') {
    var help = 'Wilkommen bei CoffeeChat!' +
    'Wenn du einen Raum abschließen möchtest, nutze "/lock". So kann niemand mehr deinen Raum betreten.' +
    'Wenn du einen geschlossenen Raum öffnen möchtest, nutze "/unlock". Jeder Chatuser kann den Raum dann wieder betreten.' +
    'Wenn du jemanden aus deinem Raum entfernen möchtest, nutze "/remove Username".';
    console.log('[' + user.room + '] ' + user.username + ' asked for help.');
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: help, name: 'INFO'  });
  }

  if (message.startsWith('/remove ')) {
    if(!user.owner) {
      console.log('[' + user.room + '] ' + user.username + ' is not a owner and cannot remove other users.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst hier keine Personen entfernen.', name: 'PRIVATE INFO'  });
    }
    var to_remove = message.slice(7).trim();
    console.log(user.username + ' wants to remove ' + to_remove);

    for(var sid in room.users) {
      if(user.username === to_remove) {
        return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst dich nicht selber entfernen!', name: 'PRIVATE INFO'  });
      }
      if(room.users[sid].username === to_remove && user.username !== to_remove) {
        var defaultChat = conf.rooms.defaultChat.name;
        io.to(sid).emit(conf.command.chatmessage, {time: new Date(), message: 'Der Raumbesitzer hat dich aus den Raum geworfen. Du findest dich jetzt wieder im Raum "' + defaultChat + '".', name: 'PRIVATE INFO'  });

        return changeChatroom(defaultChat, io.sockets.connected[sid]);
      }
    }
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: to_remove + ' wurde nicht gefunden.', name: 'PRIVATE INFO'  });

  }

  if (message.startsWith('/owns ')) {
    if(!user.owner) {
      console.log('[' + user.room + '] ' + user.username + ' is not a owner and cannot give other users owner-rights.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du bist kein Raumbesitzer von diesem Raum.', name: 'PRIVATE INFO'  });
    }
    var newOwner = message.slice(5).trim();
    console.log(user.username + ' wants to give ' + newOwner + ' owner-rights.');

    for(var sid in room.users) {
      if(user.username === newOwner) {
        return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du bist schon Raumbesitzer!', name: 'INFO'  });
      }
      if(room.users[sid].username === newOwner) {
        room.users[sid].owner = true;
        return io.to(room.users[sid].room).emit(conf.command.chatmessage, {time: new Date(), message: newOwner + ' ist jetzt Raumbesitzer im Raum "' + room.users[sid].room + '".', name: 'INFO'  });
      }
    }
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: newOwner + ' wurde nicht gefunden.', name: 'INFO'  });

  }

  if (message.startsWith('/ownsNot ')) {
    if(!admins.hasOwnProperty(user.username)) {
      console.log('[' + user.room + '] ' + user.username + ' is not a admin and cannot remove other users owner-rights.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst diesen Befehl nicht benutzen!', name: 'PRIVATE INFO'  });
    }
    var oldOwner = message.slice(8).trim();
    console.log(user.username + ' wants to take the owner-rights from ' + oldOwner);

    for(var sid in room.users) {
      if(user.username === oldOwner) {
        return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst dir nicht selber Rechte entziehen!', name: 'INFO'  });
      }
      if(room.users[sid].username === oldOwner) {
        room.users[sid].owner = false;
        return io.to(room.users[sid].room).emit(conf.command.chatmessage, {time: new Date(), message: oldOwner + ' ist jetzt kein Raumbesitzer mehr im Raum "' + room.users[sid].room + '".', name: 'INFO'  });
      }
    }
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: oldOwner + ' wurde nicht gefunden.', name: 'INFO'  });

  }

  if (message.startsWith('/all ')) {
    if(!admins.hasOwnProperty(user.username)) {
      console.log('[' + user.room + '] ' + user.username + ' is not a admin and cannot use the "/all"-Command.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst diesen Befehl nicht benutzen!', name: 'INFO'  });
    }
    var text = message.slice(4).trim();
    console.log('[Admindurchsage]: ' + text + ' from ' + user.username)
    return io.emit(conf.command.chatmessage, {time: new Date(), message: text , name: 'ADMINDURCHSAGE'  });

  }

  else {
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Der Befehl ' + message + ' existiert nicht. Für mehr Informationen nutze den Befehl "/help".', name: 'INFO'  });
  }
}

var changeChatroom = function(roomname, socket) {
  var user = users[socket.id];
  console.log(user);

  var rname = user.room || conf.rooms.defaultChat.name;
  var oldRoom = chatrooms[rname];

  //User befindet sich bereits in dem Raum
  if(rname === roomname) {
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du befindest dich bereits im Raum "' + roomname + '" .', name: 'PRIVATE INFO'  });
  }

  //Prüfe, ob der gewünschte Raum schon vorhanden ist
  if(chatrooms[roomname]) {
    if(!chatrooms[roomname].public && !admins.hasOwnProperty(user.username)) {
      //Room ist privat - User kann nicht in den Raum wechseln (außer als Admin)
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Der gewünschte Raum "' + roomname + '" ist privat.', name: 'PRIVATE INFO'  });
    }
    console.log('User ' + user.username + ' changed to Room "' + roomname + '".');
    user.owner = false;

    // Admins haben immer und überall den Owner-Status
    if(admins.hasOwnProperty(user.username)) {
      user.owner = true;
    }
  }
  // Raum noch nicht vorhanden - neuen Raum erstellen
  else {
    chatrooms[roomname] = { name: roomname, public: true, users: {}};
    user.owner = true;
    console.log('Room "' + roomname + '" created!');
  }

  console.log('User ' + user.username + ' changed from ' + user.room +  ' to Room "' + roomname + '".');
  io.to(user.room).emit(conf.command.chatmessage, {time: new Date(), message: user.username +' ist in den Raum "' + roomname + '" gewechselt.', name: 'INFO'  });
  socket.leave(user.room);

  //User wird über seine Socket.id aus alter Raumliste entfernt
  delete oldRoom.users[socket.id];
  delete chatrooms[rname].users[socket.id];

  // Alte (leere) Räume entfernen
  updateRoomlist(rname);

  user.room = chatrooms[roomname].name;
  chatrooms[roomname].users[socket.id] = user;

  socket.join(user.room);

  //Server sends ChangeRoom-Event to all users in the new room with
    //Object users[sid]             - the person,
    //Array Object.keys(chatrooms)  - all chatrooms,
    //Object chatrooms[roomname]    - the new room
  io.to(roomname).emit(conf.command.changeRoom, user, Object.keys(chatrooms), chatrooms[roomname]);

}
