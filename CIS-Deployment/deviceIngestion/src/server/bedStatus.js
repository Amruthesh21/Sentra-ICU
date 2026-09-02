/**
 * In-memory bed status tracker, shared by tcpServer.js (HL7) and
 * jsonServer.js (JSON) so GET /api/status reports both protocol families
 * from one place instead of two servers maintaining separate maps that
 * httpServer.js would then have to merge.
 */

/** @type {Map<string, {bedId: string, deviceType: string, lastMessageAt: string, messageCount: number, lastAlerts: object[]}>} */
const bedStatus = new Map();

function recordStatus(bedId, deviceType, alerts) {
  const now = new Date().toISOString();
  const existing = bedStatus.get(bedId);
  bedStatus.set(bedId, {
    bedId,
    deviceType,
    lastMessageAt: now,
    messageCount: (existing?.messageCount || 0) + 1,
    lastAlerts: alerts,
  });
}

function getBedStatus() {
  return Array.from(bedStatus.values());
}

module.exports = { recordStatus, getBedStatus };
