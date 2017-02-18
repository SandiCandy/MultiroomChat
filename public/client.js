"use strict"

// Connect
var socket = io();

//User sends the username from the Server as "login"-Event with
//username - username (String)
$('#user-login.loginscreen form').submit(function(){
  var username = $('#nickname').val();
  if (username)
  {
    $('#username').val(username);
    socket.emit('login', username);
  }
  return false;
});

socket.on('login-error', function(username) {
  //TODO: Fehlermeldung ausgeben
  $('#username').val('');
  $('#nickname').val('');
  if($('#user-login').length) {
    $('.loginscreen')
      .prepend($('<p>').text('Benutzername nicht verfügbar!'));
  }
  if($('#admin-login').length) {
    $('.loginscreen')
      .prepend($('<p>').text('Benutzername oder Password fehlerhaft!'));
  }

});

//TODO
//Admin sends the username from the Server as "login"-Event with
//username - username (String)
//password
$('#admin-login.loginscreen form').submit(function(){
  var username = $('#nickname').val();
  var pw = $('#pw').val();
  if (username && pw)
  {
    $('#username').val(username);
    socket.emit('admin-login', username, pw);
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

// User sends a message to the server, which get this as an "chatmessage"-Event
// msg  - chatmessage (String)
$('#chatform').submit(function(){
  let msg = $('#message').val();

  if (msg)
  {
    socket.emit('chatmessage', msg);
    $('#message').val('');
  }
  return false;
});

//Receive the chatmessages from the Server with Object data
//data.name     - username    (String)
//data.message  - chatmessage (String)
socket.on('chatmessage', function(data){
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

// User sends a picture to the server, which get this as an "user-image"-Event
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
          socket.emit('user-image', e.target.result);
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
socket.on('user-image', function(data){
  let time = new Date(data.time);
  let hours = time.getHours() < 10 ? '0' + time.getHours() : time.getHours();
  let minutes = time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes();

  $('#messages')
    .append($('<li>').text('[' + hours + ':' + minutes + '] ')
      .append($('<b>').text(data.name + ': '),
        '<img class="chat-image" src="' + data.message + '"/>'));
});

//Create new room and step in
//User sends the roomname to the server, which get this as an "change-room"-Event
  //room  - roonname (String)
$('form#room-form').submit(function() {
  var room = $('#room').val();

  if(room)
  {
    socket.emit('change-room', room);
    $('#room').val('');
  }
  return false;

});

//Receive the chatmessages from the Server with Object person, the array chats and the Object chatroom
  //person.username - username    (String)
  //data.message    - chatmessage (String)
socket.on('change-room', function(person, chats, chatroom){

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
      socket.emit('change-room', chat);
    });
  });
};

var updateUserList = function(chatroom) {
    $('#counter').empty();
    $('#userlist').empty();
    var count = 0;
    for (var id in chatroom.users) {
      var username = chatroom.users[id].username;

      $('#userlist')
        .append($('<li>', { html: chatroom.users[id].username, class: 'user chatroom', id: chatroom.users[id].username}))

      if(chatroom.users[id].owner) {
        $('#' + username).prepend($('<span>', { html: ' ' class: 'glyphicon glyphicon-star-empty'}));
      }

      document.getElementById(chatroom.users[id].username).addEventListener('click', function(event) {
        event.preventDefault();
      });

      count++;
    }

    $('#counter').append($('<span>', {html: count + ' User anwesend'}))
};
