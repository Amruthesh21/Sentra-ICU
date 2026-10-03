/**
 * RabbitMQ publisher — same connection pattern as
 * notificationService/src/rabbitmq.js, mirrored here for a publisher instead
 * of a consumer. Publishes directly to alarm-engine's device-data queue,
 * bypassing device.data.queue / the shovel entirely (that path belongs to
 * Connect Engine / the device simulator).
 *
 * Retries forever with backoff: a hospital gateway must survive VPN flaps
 * and cloud RabbitMQ restarts without staying dead until someone notices.
 */

const amqp = require('amqplib');
const env = require('../env');

let connection;
let channel;
let connecting = null;
let reconnectTimer = null;
let shuttingDown = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleReconnect() {
  if (shuttingDown || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch((err) => {
      console.error('[rabbit] reconnect failed:', err.message);
      scheduleReconnect();
    });
  }, env.RABBITMQ_RECONNECT_MS);
}

async function connectOnce() {
  connection = await amqp.connect(env.RABBITMQ_URL);
  connection.on('error', (err) => console.error('[rabbit] connection error:', err.message));
  connection.on('close', () => {
    console.warn('[rabbit] connection closed — reconnecting');
    connection = null;
    channel = null;
    connecting = null;
    if (!shuttingDown) scheduleReconnect();
  });

  channel = await connection.createChannel();
  // durable:true matches the Queue bean declared in alarm-engine's
  // RabbitMQConfig.java — same queue, so the declaration must agree.
  await channel.assertQueue(env.DEVICE_DATA_QUEUE, { durable: true });
  console.log(`[rabbit] connected, publishing to queue: ${env.DEVICE_DATA_QUEUE}`);
  return channel;
}

async function connect() {
  if (channel) return channel;
  if (connecting) return connecting;

  connecting = (async () => {
    let delayMs = env.RABBITMQ_RECONNECT_MS;
    const maxDelay = 30000;
    for (;;) {
      try {
        return await connectOnce();
      } catch (err) {
        console.error(`[rabbit] connect failed: ${err.message}; retrying in ${delayMs}ms`);
        await delay(delayMs);
        delayMs = Math.min(delayMs * 2, maxDelay);
      }
    }
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
  const ok = ch.sendToQueue(env.DEVICE_DATA_QUEUE, payload, {
    contentType: 'application/json',
    persistent: true,
  });
  if (!ok) {
    console.warn('[rabbit] sendToQueue returned false (buffer full) — message may be delayed');
  }
}

async function close() {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (channel) {
    try { await channel.close(); } catch { /* already closed */ }
  }
  if (connection) {
    try { await connection.close(); } catch { /* already closed */ }
  }
  channel = null;
  connection = null;
}

module.exports = { connect, publishDeviceData, close, isConnected };

function isConnected() {
  return Boolean(channel);
}
