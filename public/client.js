"use strict"

<!-- Connect -->
var socket = io();

$('#loginscreen form').submit(function(){
  var username = $('#nickname').val();
  if (username)
  {
    $('#username').val(username);
    socket.emit('login', username);
  }
  return false;
});

socket.on('login', function(person, chats){
  //console.log('login', person);
  if(!$('#loginscreen').hasClass('hidden')) {
    $('#loginscreen').addClass('hidden');
    $('#chat').removeClass('hidden');
    $('#sidebar').removeClass('hidden');

    // Liste mit aktuellen Chats aktualisieren
    updateChatList(chats);

  }

  var msg = 'User ' + person.username + ' hat den Chat ' + person.room.name + ' betreten.'
  $('#messages').append($('<li>').text(msg));

});

// User sends a message to the server, which get this as an "chat message"-Event
$('#chatform').submit(function(){
  let msg = $('#message').val();

  if (msg)
  {
    socket.emit('chat message', {message: msg});
    $('#message').val('');
  }
  return false;
});

//Receive the messages from the Server
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

// User sends a picture to the server, which get this as an "chat message"-Event
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


socket.on('user image', function(data){
  let time = new Date(data.time);
  let hours = time.getHours() < 10 ? '0' + time.getHours() : time.getHours();
  let minutes = time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes();

  $('#messages')
    .append($('<li>').text('[' + hours + ':' + minutes + '] ')
      .append($('<b>').text(data.name + ': '),
        '<img class="chat-image" src="' + data.message + '"/>'));
});

//Neuen Raum erstellen und betreten
$('form#room-form').submit(function() {
  var room = $('#room').val();

  if(room)
  {
    socket.emit('changeRoom', room);
    $('#room').val('');
  }
  return false;

});

socket.on('changeRoom', function(person, chats){
  console.log('User ' + person.username + ' changed to room ' + person.room.name + '!');

  var msg = 'User ' + person.username + ' hat den Chat ' + person.room.name + ' betreten.'
  $('#messages').append($('<li>').text(msg));

  $('#rooms').empty();

  // Liste mit aktuellen Chats aktualisieren
  updateChatList(chats);

});

socket.on('logout message', function(){
  var msg = 'User  hat den Chat verlassen.'
  $('#messages').append($('<li>').text(msg));
});

var updateChatList = function(chats) {
  chats.map(function(chat) {
    $('#rooms')
      .append($('<li>', {class: 'room'})
        .append($('<a/>', { html: chat.name, class: 'chatroom', id: chat.name,  href: ''}))
      )

    document.getElementById(chat.name).addEventListener('click', function(event) {
      event.preventDefault();
      socket.emit('changeRoom', chat.name);
    });
  });
}
