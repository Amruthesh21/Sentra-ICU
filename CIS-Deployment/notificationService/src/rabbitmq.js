const amqp = require('amqplib');
const pushService = require('./pushService');
const subscriptionModel = require('./models/PushSubscription');

const QUEUE = 'alarm.notify.queue';

let connection;
let channel;

async function startConsumer(rabbitUrl) {
  connection = await amqp.connect(rabbitUrl);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.prefetch(1);

  console.log(`Listening on queue: ${QUEUE}`);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const alarm = JSON.parse(msg.content.toString());
      console.log(`Alarm received: bed=${alarm.bedId} param=${alarm.paramName} severity=${alarm.severity}`);

      const subscriptions = await subscriptionModel.findByBedId(alarm.bedId);

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions for bed ${alarm.bedId}`);
      } else {
        for (const sub of subscriptions) {
          try {
            const payload = await pushService.sendPush(sub, alarm);
            console.log(`Push sent to ${sub.doctorId}: ${payload.title}`);
          } catch (err) {
            console.error(`Push failed for ${sub.doctorId}:`, err.statusCode, err.body || err.message);
            if (err.statusCode === 410 || err.statusCode === 404) {
              await subscriptionModel.removeSubscription(sub.doctorId);
              console.log(`Removed expired subscription for ${sub.doctorId}`);
            }
          }
        }
      }

      channel.ack(msg);
    } catch (err) {
      console.error('Failed to process alarm message:', err.message);
      channel.nack(msg, false, false);
    }
  });
}

async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { startConsumer, close };
