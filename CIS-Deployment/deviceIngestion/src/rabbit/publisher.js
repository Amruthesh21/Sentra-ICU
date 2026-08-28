/**
 * RabbitMQ publisher — same connection pattern as
 * notificationService/src/rabbitmq.js, mirrored here for a publisher instead
 * of a consumer. Publishes directly to alarm-engine's device-data queue,
 * bypassing device.data.queue / the shovel entirely (that path belongs to
 * Connect Engine / the device simulator).
 */

const amqp = require('amqplib');
const env = require('../env');

let connection;
let channel;
let connecting = null;

async function connect() {
  if (channel) return channel;
  if (connecting) return connecting;

  connecting = (async () => {
    connection = await amqp.connect(env.RABBITMQ_URL);
    connection.on('error', (err) => console.error('[rabbit] connection error:', err.message));
    connection.on('close', () => {
      console.warn('[rabbit] connection closed — will reconnect on next publish');
      connection = null;
      channel = null;
    });

    channel = await connection.createChannel();
    // durable:true matches the Queue bean declared in alarm-engine's
    // RabbitMQConfig.java — same queue, so the declaration must agree.
    await channel.assertQueue(env.DEVICE_DATA_QUEUE, { durable: true });
    console.log(`[rabbit] connected, publishing to queue: ${env.DEVICE_DATA_QUEUE}`);
    return channel;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/** @param {object} deviceDataMessage */
async function publishDeviceData(deviceDataMessage) {
  const ch = await connect();
  const payload = Buffer.from(JSON.stringify(deviceDataMessage));
  ch.sendToQueue(env.DEVICE_DATA_QUEUE, payload, { contentType: 'application/json', persistent: true });
}

async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connect, publishDeviceData, close };
