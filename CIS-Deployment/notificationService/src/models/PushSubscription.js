const { MongoClient } = require('mongodb');

const COLLECTION = 'pushSubscriptions';

let client;
let db;

async function connect(uri) {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('v2-ICU-Connect');
  await db.collection(COLLECTION).createIndex({ doctorId: 1 });
  await db.collection(COLLECTION).createIndex({ bedIds: 1 });
  return db;
}

function getCollection() {
  return db.collection(COLLECTION);
}

async function saveSubscription({ doctorId, doctorName, bedIds, subscription, publicUrl }) {
  const doc = {
    doctorId,
    doctorName: doctorName || doctorId,
    bedIds: bedIds || ['ICU-1-BED-01'],
    subscription,
    publicUrl: publicUrl || null,
    updatedAt: new Date(),
  };
  await getCollection().updateOne(
    { doctorId },
    { $set: doc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return doc;
}

async function removeSubscription(doctorId) {
  await getCollection().deleteOne({ doctorId });
}

async function listSubscriptions() {
  return getCollection().find({}).project({ subscription: 0 }).toArray();
}

function bedIdVariants(bedId) {
  const variants = new Set([bedId]);
  if (bedId?.startsWith('ICU-1-')) {
    variants.add(bedId.substring('ICU-1-'.length));
  } else if (bedId) {
    variants.add(`ICU-1-${bedId}`);
  }
  return [...variants];
}

async function findByBedId(bedId) {
  const variants = bedIdVariants(bedId);
  const matched = await getCollection().find({ bedIds: { $in: variants } }).toArray();
  if (matched.length > 0) {
    return matched;
  }
  // POC: single doctor — deliver to all registered devices if bed not listed
  return getCollection().find({ 'subscription.endpoint': { $exists: true, $ne: null } }).toArray();
}

async function findByDoctorId(doctorId) {
  return getCollection().findOne({ doctorId });
}

async function updateBedIds(doctorId, bedIds) {
  if (!bedIds?.length) return null;
  await getCollection().updateOne(
    { doctorId },
    { $set: { bedIds, updatedAt: new Date() } }
  );
  return findByDoctorId(doctorId);
}

module.exports = {
  connect,
  saveSubscription,
  removeSubscription,
  listSubscriptions,
  findByBedId,
  findByDoctorId,
  updateBedIds,
  bedIdVariants,
};
