var
  sys = require("sys"),
  redis = require("../vendor/redis-client");

function log(what) {
  sys.log("[ext:pubpersist] " + what);
}

exports.init_extension = function (options, context) {
  log("initializing.");

  var redis_client = context.redis.client;
  var pubsub_client = redis.createClient(context.redis.port, context.redis.host);

  if (!options.channelPattern) {
    throw new Error("Missing required option: 'channelPattern'");
  }

  if (typeof options.persistKeyPrefix != 'string') {
    log("Missing optional option: 'persistKeyPrefix' Defaulting to: 'nr:pubsub:published:#{channel}'");
    options.persistKeyPrefix = 'nr:pubsub:published:';
  }

  pubsub_client.select(options.db || context.redis.db, function (err) {
    if (err) throw new Error(err);
  });

  context.emitter.addListener("disconnected", function (client) {
    pubsub_client.unsubscribeFrom(options.channelPattern);
  });

  pubsub_client.subscribeTo(options.channelPattern, function (channel, message, pattern) {
    log("Received: channel: " + channel.toString() + " pattern: " + (pattern ? pattern.toString() : null) + " message: " +  message.toString());
    var now = Math.round(new Date().getTime()/1000.0);
    var msg_obj = false;

    try {
      msg_obj = JSON.parse(message.toString());
      msg_obj.channel = channel.toString();
      msg_obj.created_at = now.toString();
      msg_obj.updated_at = now.toString();
      log("Persisting: message: " + JSON.stringify(msg_obj));
    } catch (e) {
      log("invalid message! expecting proper JSON");
      return;
    }

    redis_client.zadd(channel.toString(), now.toString(), msg_obj.guid, function (err, reply) {
        if (err) throw new Error(err);
        log("Persisted to set: " + channel.toString() + " reply from redis:" + reply);
      });

    redis_client.set(options.persistKeyPrefix + ":" + msg_obj.guid, JSON.stringify(msg_obj), function (err, reply) {
        if (err) throw new Error(err);
        log("Persisted to key: " + options.persistKeyPrefix + ":" + msg_obj.guid + " reply from redis:" + reply);
      });
  });

};

exports.deinit_extension = function (context, callback) {
  log("deinitializing.");
  callback();
};

