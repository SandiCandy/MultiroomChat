var express = require('express');
var app = require('express')();
var http = require('http').Server(app);

//Config-File
var conf = require('./config.json');

//MongoDB
var mongoose = require('mongoose');
// mongoose.connect('mongodb://localhost/test');
//
// var db = mongoose.connection;
// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', function() {
//   // we're connected!
// });

// create a schema for chat
// var UserSchema = mongoose.Schema({
//   sid: String,
//   username: String,
//   room: Boolean,
//   owner: Boolean,
//   admin: Boolean
// });
//
// var AdminSchema = mongoose.Schema({
//   username: String,
//   password: String
// });
//
// var ChatSchema = mongoose.Schema({
//   name: String,
//   public: Boolean,
//   users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
// });
//
// //Create models from the Schemes
// var User = mongoose.model('User', UserSchema);
// var Admin = mongoose.model('Admin', AdminSchema);
// var Chat = mongoose.model('Chat', ChatSchema);

//DefaultChats
// var chat1 = new Chat({ name: 'Neu bei CoffeeChat', public: true });
// var chat2 = new Chat({ name: 'Osnabrück und Umgebung', public: true });
// var chat3 = new Chat({ name: 'Studententreff', public: true });
// var chat4 = new Chat({ name: 'Professorentreff', public: false });

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


app.post('/setup', function(req, res) {
  var chats = [
    { name: 'Neu bei CoffeeChat', public: true },
    { name: 'Osnabrück und Umgebung', public: true },
    { name: 'Studententreff', public: true },
    { name: 'Professorentreff', public: false }];

    //Loop through each of the chat data and insert into the database
    chats.forEach(function(chat){
      var newChat = new Chat(chat);
      newChat.save(function(err, savedChat) {
        console.log(savedChat);
      });
    });

  //Send a resoponse so the serve would not get stuck
  res.send('created');
});
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
  socket.on(conf.command.login, function(username) {
    //Checken, ob username schon vergeben ist
    for(let sid in users){
      if(users[sid].username === username) {
        return io.to(socket.id).emit(conf.command.loginError, username);
      }
    }
    //Checken, ob username einem Admin gehört
    if(admins.hasOwnProperty(username)) {
        return io.to(socket.id).emit(conf.command.loginError, username);
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
    //Object.keys(chatroom) - contains an array of Strings with all roomnames with
      //defaultRoom - current room
      //defaultRoom.name   - roomname
      //defaultRoom.public - boolean
      //defaultRoom.users - Object with all Persons in the room (key: socket.id, value: user-Object)
    io.to(defaultRoom.name).emit(conf.command.login, newPerson, Object.keys(chatrooms), defaultRoom);

  });

  //Server receive 'login'-Event with String username
  socket.on(conf.command.adminLogin, function(username, pw) {
    console.log('Admin-Login: ' + username + ': ' + pw);
    if(!admins.hasOwnProperty(username) && admins[username] !== pw) {
      return io.to(socket.id).emit(conf.command.loginError, username);
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
    io.to(defaultRoom.name).emit(conf.command.login, newPerson, Object.keys(chatrooms), defaultRoom);

  });

  //Server receive 'change-room'-Event with String roomname
  socket.on(conf.command.changeRoom, function(roomname) {
    //var user = users[socket.id];

    changeChatroom(roomname, socket);

  });


  //Server receive 'chatmessage'-Event with String message from a user
  socket.on(conf.command.chatmessage, function(message) {
    var user = users[socket.id];
    var room = chatrooms[user.room];
    if(message.startsWith('/')) {
      // Special commands
      return handleChatcommand(message, socket);
    }

    console.log('[' + user.room + '] message: ' + message + ' from ' + user.username);
    io.to(user.room).emit(conf.command.chatmessage, {time: new Date(), message: message, name: user.username || 'Anonym'  });
  });

  ///Server receive 'user-image'-Event with data (base64 file) from a user
  socket.on(conf.command.userImage, function (data) {
    var user = users[socket.id];
    console.log('Received base64 file from ' + user.username);
    //Received an image: broadcast to all in a room
    io.to(user.room).emit(conf.command.userImage, {time: new Date(), message: data, name: user.username || 'Anonym'  });
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
      io.to(user.room).emit(conf.command.chatmessage, {time: new Date(), message: user.username +' hat den Chat verlassen.', name: 'INFO'  });
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

// Sonderbefehle bearbeiten
var handleChatcommand = function(message, socket) {
  var user = users[socket.id];
  var room = chatrooms[user.room];

  if (message.startsWith('/remove ')) {
    if(!user.owner) {
      console.log('[' + user.room + '] ' + user.username + ' is not a owner and cannot remove other users.');
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst hier keine Personen entfernen.', name: 'INFO'  });
    }
    var to_remove = message.slice(7).trim();
    console.log(user.username + ' wants to remove ' + to_remove);

    for(let sid in room.users) {
      if(user.username === to_remove) {
        return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Du kannst dich nicht selber entfernen!', name: 'INFO'  });
      }
      if(room.users[sid].username === to_remove && user.username !== to_remove) {
        var defaultChat = conf.rooms.defaultChat.name;
        io.to(sid).emit(conf.command.chatmessage, {time: new Date(), message: 'Der Raumbesitzer hat dich aus den Raum geworfen. Du findest dich jetzt wieder im Raum "' + defaultChat + '".', name: 'INFO'  });

        return changeChatroom(defaultChat, io.sockets.connected[sid]);
      }
    }
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: to_remove + ' wurde nicht gefunden.', name: 'INFO'  });

  }

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

  else {
    return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Der Befehl ' + message + ' existiert nicht. Für mehr Informationen nutze den Befehl "/help".', name: 'INFO'  });
  }
}

var changeChatroom = function(roomname, socket) {
  var user = users[socket.id];
  var rname = user.room;
  var oldRoom = chatrooms[rname];
  var existingRoom = false;

  if(chatrooms[roomname]) {
    existingRoom = true;
    if(!chatrooms[roomname].public) {
      //Room ist privat - User kann nicht in den Raum wechseln
      return io.to(socket.id).emit(conf.command.chatmessage, {time: new Date(), message: 'Der gewünschte Raum "' + roomname + '" ist privat.', name: 'INFO'  });
    }
    console.log('User ' + user.username + ' changed to Room "' + roomname + '".');
    user.owner = false;

  }

  // Room doesnt exist - create new room
  if(!existingRoom) {
    chatrooms[roomname] = { name: roomname, public: true, users: {}};
    user.owner = true;
    console.log('Room "' + roomname + '" created!');
  }

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
