
io.setPath('/nodered/lib/vendor/socket.io-node/test/client/');

function NodeRedClient() {
  this.next_id  = 0;
  this.pending = {};  // id => function
  this.connecting = false;

  // Reconnect with exponential backoff (reconnect after 1s, 2s, 4s, 8s, ...).
  // The server can be down for about 4 minutes total before we give up.

  this.reconnect_attempts = 0;
  this.max_reconnect_attempts = 7;
}



function message(obj){
  var el = document.createElement('p');
  if ('announcement' in obj) el.innerHTML = '<em>' + obj.announcement;
  else if ('message' in obj) el.innerHTML = '<b>' + obj.message[0] + ':</b> ' + obj.message[1];
  if (el) {
    document.getElementById('chat').appendChild(el);
    document.getElementById('chat').scrollTop = 1000000;
  }
}

function send(){
  var val = document.getElementById('text').value;
  socket.send(val);
  message({ message: ['you', val] });
  document.getElementById('text').value = '';
}





NodeRedClient.prototype.connect = function (host, port) {
  if (this.ws || this.connecting)
    return;

  console.log('connecting to ' + host + ':' + port);

  this.connecting = true;
  this.expected_close = false;

  var self = this;

  ws = new io.Socket((host || 'localhost'), {host: (host || 'localhost'), rememberTransport: false, port: (port || 8081)});
  ws.addEvent('connect', function(){
    console.log('connected');
    self.ws = ws;
    self.add_extension_support('metadata');     // must always be enabled.

    if (self.on_connected)
      self.on_connected();

    self.connecting = false;
    self.reconnect_attempts = 0;

    // Let's try to avoid client side idleness which seems to close the
    // connection.  Poor man's keepalive.

    self.heartbeat = setInterval(function () {
      if (self.ws) self.ping();
    }, 30*1000);
  });

  ws.addEvent('message', function(data){
    console.log('message received: ' + data);
    try {
      var obj = JSON.parse(data);
    } catch (e) {
    }

    if (!obj || !(obj instanceof Object))
      throw "malformed message";

    if (obj.notice) {
      if (obj.notice.quit) {
        self.expected_close = true;
        self.ws.close();
      }
      if (self.on_notice)
        self.on_notice(obj.notice);
    } else if (obj.id !== undefined && self.pending[obj.id]) {
      self.pending[obj.id](obj.error || null, obj.body || null);
      delete self.pending[obj.id];
    }
  });

  ws.addEvent('disconnect', function(){
    console.log('not connected ' + (!self.expected_close ? ' (unexpected)' : ''));

    if (self.heartbeat !== undefined)
      clearInterval(self.heartbeat);

    self.connecting = false;

    self.ws = null;
    delete self.ws;

    if (self.on_disconnected)
      self.on_disconnected();

    if (!self.expected_close && ++self.reconnect_attempts < self.max_reconnect_attempts) {
      var timeout = Math.pow(2, self.reconnect_attempts) * 1000;  // exponential backoff
      console.log('trying to reconnect in ' + timeout + ' ms ...');
      setTimeout(function () {
        if (self.on_reconnect_attempt)
          self.on_reconnect_attempt(self.reconnect_attempt);
        self.connect(host, port);
      }, timeout);
    }
  });


  ws.connect();
}

NodeRedClient.prototype.add_extension_support = function (ext_name) {
  var make_requester = function (command_name) {
    return function () {
      if (!this.ws) return;

      var arg_count = arguments.length;
      var callback = arguments[arguments.length - 1];
      if (typeof callback == "function") arg_count--;

      var request = {
        id: this.next_id++,
        cmd: command_name,
        body: []
      };

      for (var i=0; i < arg_count; ++i)
        request.body.push(arguments[i]);

      if (request.body.length == 0)
        delete request.body;

      this.pending[request.id] = callback;

      var cmd = JSON.stringify(request) + "\r\n";
      this.ws.send(cmd);
    };
  };

  var extension_commands = {
    basic:    [ 'QUIT', 'PING' ],
    metadata: [ 'LOCAL', 'CLUSTER' ],
    pubsub:   [ 'LIST', 'SUBSCRIBE', 'UNSUBSCRIBE', 'PUBLISH' ],
    pubpersist: [],
    nickname: [ 'NICKNAME' ]
  };

  var to_add = extension_commands[ext_name];

  if (!to_add)
    alert("Internal error! I don't know how to add support for: " + ext_name);
  else
    for (var i=0; i<to_add.length; ++i)
      NodeRedClient.prototype[to_add[i].toLowerCase()] = make_requester(to_add[i]);
};

