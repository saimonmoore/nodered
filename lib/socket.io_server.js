var
  sys = require("sys"),
  url = require('url'),
  http = require('http'),
  NodeRedClient = require("./client").Client,
  io = require('./vendor/socket.io-node/lib/socket.io'),
  dispatch = require("./request_dispatch"),
  json = JSON.stringify,

  send404 = function(res){
    res.writeHead(404);
    res.write('404');
    res.end();
  };

function SocketIOServer(ip, port) {
  this.ip = ip;
  this.port = port;

  var banner = "[sio]" + this.ip + ":" + this.port + " ";
  this.log = function (what) {
    sys.log(banner + what);
  };

  var self = this;

  server = http.createServer(function(req, res){
  // your normal server code
  var path = url.parse(req.url).pathname;
  switch (path){
    case '/':
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write('<h1>Move along. Nothing to see...</h1>');
      res.end();
      break;

    default:
      if (/\.(js|html|swf)$/.test(path)){
        try {
          var swf = path.substr(-4) == '.swf';
          res.writeHead(200, {'Content-Type': swf ? 'application/x-shockwave-flash' : ('text/' + (path.substr(-3) == '.js' ? 'javascript' : 'html'))});
          res.write(fs.readFileSync(__dirname + path, swf ? 'binary' : 'utf8'), swf ? 'binary' : 'utf8');
          res.end();
        } catch(e){
          send404(res);
        }
        break;
      }

      send404(res);
      break;
  }
});
  server.listen(this.port, this.ip);

  io.listen(server, {
    onClientConnect: function(client){
      //io.socket.Client uses _onDisconnect and we don't have access to it's prototype
      client.end = client._onDisconnect;

      if (our.shutting_down || Object.keys(our.clients).length > our.max_clients) {
        client._onDisconnect();
      }

      client.noderedClient = new NodeRedClient(self, client);
      self.log("⇔ " + client.noderedClient + " connected");
      our.clients[client.noderedClient.id] = client.noderedClient;
      our.emitter.emit("connected", client.noderedClient);
    },
    onClientDisconnect: function(client){
      client.end = client._onDisconnect;
      if (client.heartbeatInterval) {
        clearInterval(client.heartbeatInterval);
      }

      self.log("⇎ " + client.noderedClient + " disconnected");
      our.emitter.emit("disconnected", client.noderedClient);

      delete our.clients[client.noderedClient.id];

      our.redis.client.hincrby(our.metadata_key, 'client_count', -1,
        function (err, reply) {
          if (err) throw new Error(err);
          our.client_count--;
        });
    },
    onClientMessage: function(message, client){
      client.end = client._onDisconnect;

      var msg = false;
      try {
        msg = message.replace(/\}\s*\r\n/g, ', "sessionid": "' + client.sessionId + '"\} \r\n');
      } catch (e) {
        self.log(e);    // pass-through
      }

      if (our.shutting_down) return;
      self.log("⇇ " + msg + ": " + msg.replace(/\r\n/g, '<crlf>'));

      try {
        client.noderedClient.parser.feed(msg);
        our.dispatch._next_request(client.noderedClient);
      } catch (e) {
        client.noderedClient.kill(e.message);
      }
    }
  });

  this.log("listening!");
}

exports.SocketIOServer = SocketIOServer;

SocketIOServer.prototype.write = function (conduit, data) {
  conduit.send(data);      // conduit is a socket.io.Client
};

exports.create = function (ip, port) {
  return new SocketIOServer(ip, port);
};

