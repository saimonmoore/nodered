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
    log("Received: channel: " + channel.toString() + " pattern: " + (pattern ? pattern.toString() : null) + " message: " +  message.toString() + " guid: " + message.guid);
    var now = new Date().getTime();

    redis_client.zadd(options.persistKeyPrefix + channel.toString(), now.toString(), message.guid, function (err, reply) {
        if (err) throw new Error(err);
        log("zadd reply from redis:" + reply);
      });

    message.created_at = now.toString();
    message.updated_at = now.toString();

    redis_client.set(options.persistKeyPrefix + channel.toString() + ":" + message.guid, message.toString(), function (err, reply) {
        if (err) throw new Error(err);
        log("set reply from redis:" + reply);
      });
  });

};

exports.deinit_extension = function (context, callback) {
  log("deinitializing.");
  callback();
};

