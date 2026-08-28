/**
 * Builds the exact DeviceDataMessage JSON shape alarm-engine's
 * DeviceDataConsumer expects:
 *   { bedId, deviceType, timestamp, primaryAttributes: [{name, value, unit}], secondaryAttributes: [] }
 * (see alarmEngine/src/main/java/com/sentraicu/alarmengine/dto/DeviceDataMessage.java —
 * not modified by this service). `name` is accepted via @JsonAlias, so this
 * plain key works as-is.
 */

/**
 * @param {ReturnType<import('../core/hl7Parser').parseHl7Message>} parsedHl7
 * @param {import('../adapters/deviceAdapter')} adapter
 * @param {string} bedId
 */
function buildDeviceDataMessage(parsedHl7, adapter, bedId) {
  const primaryAttributes = [];
  const secondaryAttributes = [];

  for (const obs of parsedHl7.observations) {
    const mapped = adapter.mapObservation(obs);
    if (!mapped) continue; // dropped — unknown field, sentinel/no-data, or non-vital

    const attr = { name: mapped.name, value: mapped.value, unit: mapped.unit };
    if (adapter.classify(mapped.name) === 'primary') {
      primaryAttributes.push(attr);
    } else {
      secondaryAttributes.push(attr);
    }
  }

  return {
    bedId,
    deviceType: adapter.deviceType,
    timestamp: parsedHl7.timestamp,
    primaryAttributes,
    secondaryAttributes,
  };
}

/** Device alerts (Lead Off, Sensor Off, etc.) have no field in
 * DeviceDataMessage, so they're not published to RabbitMQ — surfaced here
 * for the HTTP status endpoint instead. See adapters/bplVividVueM10.js. */
function extractAlerts(parsedHl7, adapter) {
  if (!adapter.mapAlert) return [];
  return parsedHl7.alerts
    .map((a) => adapter.mapAlert(a))
    .filter(Boolean);
}

module.exports = { buildDeviceDataMessage, extractAlerts };
