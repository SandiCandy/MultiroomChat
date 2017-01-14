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
  console.log('loginblabla', person);
  sessionStorage.setItem('Room', JSON.stringify(person.room));
  //sessionStorage.setItem('User', JSON.stringify(person));
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
  let user = $('#username').val();

  if (msg)
  {
    socket.emit('chat message', {time: new Date(), message: msg, username: user});
    $('#message').val('');
  }
  return false;
});

//Receive the messages from the Server
socket.on('chat message', function(data){
  var time = new Date(data.time);
  var hours = time.getHours() < 10 ? '0' + time.getHours() : time.getHours();
  var minutes = time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes();
  var newMessage = $('<li>').innerHTML = '[ '+ hours + ':' + minutes + '] <b>' + data.name + ': </b>' + data.message + '<br />';

  $('#messages').append(
    newMessage
  );

  // Scroll down
  $('body').scrollTop($('body')[0].scrollHeight);
});

//Neuen Raum erstellen und betreten
$('form#room-form').submit(function() {
  var room = $('#room').val();
  var username = $('#nickname').val();

  if(room)
  {
    socket.emit('changeRoom', room);
    $('#room').val('');
  }

  return false;
});

socket.on('changeRoom', function(person, chats){
  console.log('User ' + person.username + ' changed to room ' + person.room.name + '!');
  sessionStorage.setItem('Room', JSON.stringify(person.room));

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
