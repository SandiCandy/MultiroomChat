"use strict"

// Connect
var socket = io();

//User sends the username from the Server as "login"-Event with
//username - username (String)
$('.loginscreen form').submit(function(){
  var username = $('#nickname').val();
  if (username)
  {
    $('#username').val(username);
    socket.emit('login', username);
  }
  return false;
});

//TODO
//Admin sends the username from the Server as "login"-Event with
//username - username (String)
//password
$('#admin.loginscreen form').submit(function(){
  var username = $('#nickname').val();
  if (username)
  {
    $('#username').val(username);
    socket.emit('login', username);
  }
  return false;
});

//Receive "login"-Event with Object person, Array chats, Object chatroom
//person.username - username (String)
//person.room     - current room (String)
//person.owner    - for extra features (boolean)
//
//chats - contains an array of Strings with all roomnames
//
//chatroom - current room
//chatroom.name   - roomname
//chatroom.public - boolean
//chatroom.users - Object with all Persons in the room (key: socket.id, value: user-Object)
socket.on('login', function(person, chats, chatroom){

  if(!$('.loginscreen').hasClass('hidden')) {
    $('.loginscreen').addClass('hidden');
    $('#chat').removeClass('hidden');
    $('#sidebar').removeClass('hidden');

    // Liste mit aktuellen Chats aktualisieren
    updateChatList(chats);
    updateUserList(chatroom);

  }

  var msg = 'User ' + person.username + ' hat den Chat ' + person.room + ' betreten.'
  $('#messages').append($('<li>').text(msg));

});

// User sends a message to the server, which get this as an "chat message"-Event
// msg  - chatmessage (String)
$('#chatform').submit(function(){
  let msg = $('#message').val();

  if (msg)
  {
    socket.emit('chat message', msg);
    $('#message').val('');
  }
  return false;
});

//Receive the chatmessages from the Server with Object data
//data.name     - username    (String)
//data.message  - chatmessage (String)
socket.on('chat message', function(data){
  let time = new Date(data.time);
  let hours = time.getHours() < 10 ? '0' + time.getHours() : time.getHours();
  let minutes = time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes();

  $('#messages')
    .append($('<li>').text('[' + hours + ':' + minutes + '] ')
      .append($('<b>').text(data.name + ': '), data.message + '</br>'
    ));

  // Scroll down
  $('body').scrollTop($('body')[0].scrollHeight);
});

// User sends a picture to the server, which get this as an "user image"-Event
function dataReader(evt) {
    var files = evt.target.files; // FileList object

    // ForSchleife, da mehrere Bilder hochgeladen werden können
    for (let i = 0, f; f = files[i]; i++) {
      // nur Bild-Dateien
      if (!f.type.match('image.*')) {
        continue;
      }

      var reader = new FileReader();

      reader.onload = (function(theFile) {
        return function(e) {
          // Preview for Client
          var preview = document.createElement('img');
    		  preview.className = 'preview';
    		  preview.src = e.target.result;
    		  preview.title = theFile.name;
          document.getElementById('list').insertBefore(preview, null);
          socket.emit('user image', e.target.result);
        };
      })(f);

      // Bilder als Data URL auslesen.
      reader.readAsDataURL(f);
    }

    $('output#list').empty();
}

// Auf neue Auswahl reagieren und gegebenenfalls Funktion dataReader neu ausführen.
document.getElementById('files').addEventListener('change', dataReader, false);

//Receive pictures from the Server with Object data
//data.name     - username          (String)
//data.message  - source of picture (String)
socket.on('user image', function(data){
  let time = new Date(data.time);
  let hours = time.getHours() < 10 ? '0' + time.getHours() : time.getHours();
  let minutes = time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes();

  $('#messages')
    .append($('<li>').text('[' + hours + ':' + minutes + '] ')
      .append($('<b>').text(data.name + ': '),
        '<img class="chat-image" src="' + data.message + '"/>'));
});

//Create new room and step in
//User sends the roomname to the server, which get this as an "changeRoom"-Event
//room  - roonname (String)
$('form#room-form').submit(function() {
  var room = $('#room').val();

  if(room)
  {
    socket.emit('changeRoom', room);
    $('#room').val('');
  }
  return false;

});

//Receive the chatmessages from the Server with Object person, the array chats and the Object chatroom
//person.usernname     - username    (String)
//data.message  - chatmessage (String)
socket.on('changeRoom', function(person, chats, chatroom){
  //console.log('User ' + person.username + ' changed to room ' + person.room + '!');

  var msg = 'User ' + person.username + ' hat den Chat ' + person.room + ' betreten.'
  $('#messages').append($('<li>').text(msg));

  $('#rooms').empty();

  // Liste mit aktuellen Chats aktualisieren
  updateChatList(chats);
  updateUserList(chatroom);

});

var updateChatList = function(chats) {

    chats.map(function(chat) {
    $('#rooms')
      .append($('<li>', {class: 'room'})
        .append($('<a/>', { html: chat, class: 'chatroom', id: chat,  href: ''}))
      )

    document.getElementById(chat).addEventListener('click', function(event) {
      event.preventDefault();
      socket.emit('changeRoom', chat);
    });
  });
};

var updateUserList = function(chatroom) {
    $('#userlist').empty();
    for (var id in chatroom.users) {
    $('#userlist')
      .append($('<li>', {class: 'user'})
        .append($('<a/>', { html: chatroom.users[id].username, class: 'chatroom', id: chatroom.users[id].username,  href: ''}))
      )

    document.getElementById(chatroom.users[id].username).addEventListener('click', function(event) {
      event.preventDefault();
    });
  }
};
