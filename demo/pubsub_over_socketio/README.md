# NodeRed PUBSUB over Socket.IO Demo

1. git submodule init
1. git submodule update --init --recursive
1. Launch Redis.
1. Launch NodeRed with a `sio` server listening on port 8081.
1. Open two browser windows to the `index.html` file.
1. In both windows, subscribe to a channel (invent a channel name).
1. In one window, publish a message (e.g. Hello!).
1. See it in the other window.

Should handle any browser. Defaults to HTML5 WebSockets but then falls back to flashsocket, htmlfile, xhr-multipart and finally xhr-long polling.
This demo has been tested on Firefox, Google Chrome and WebKit Nightly, both on Mac OS X.

Furthermore, the flashsocket transport in socketio requires that
you run the demo from within a web server which is why the urls to
socket.io.js and nodered-socketio-client.js are absolute urls.

It assumes you've added the nodered directory under some public directory in your web server's virtual host

Access via: http://127.0.0.1/nodered/demo/pubsub_over_socketio/index.html
