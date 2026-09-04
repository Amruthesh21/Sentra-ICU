/**
 * Admin/health HTTP API. Not the device-facing interface (that's
 * tcpServer.js for HL7, jsonServer.js for JSON) — this is for operators/
 * dashboards to see what the service is doing.
 */

const express = require('express');
const env = require('../env');
const { getBedMap, setMapping, removeMapping } = require('../bedMapping/bedMap');
const quarantine = require('../bedMapping/quarantine');
const waveformBuffer = require('../waveform/waveformBuffer');
const { getBedStatus } = require('./bedStatus');
const { requireHubAuth } = require('./requireHubAuth');
const { ADAPTERS } = require('../adapters/registry');

function startHttpServer() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'device-ingestion' });
  });

  // Everything below is only ever meant to be called by a logged-in Hub
  // user via the /device-ingestion proxy — require the same Hub session.
  app.use('/api', requireHubAuth);

  app.get('/api/status', (_req, res) => {
    const beds = getBedStatus();
    res.json({
      beds,
      waveforms: env.WAVEFORM_PUBLISH_ENABLED
        ? waveformBuffer.getAllLatest()
        : Object.fromEntries(beds.map((b) => [b.bedId, waveformBuffer.getLatest(b.bedId)])),
      waveformPublishEnabled: env.WAVEFORM_PUBLISH_ENABLED,
    });
  });

  // Bed-scoped waveform read, for the Hub's "Live waveforms" tab — avoids
  // shipping every bed's full sample buffer (as /api/status does) just to
  // render one bed's detail page. See waveformBuffer.getLatestForBedIdVariants
  // for why the id needs normalizing rather than an exact-match lookup.
  app.get('/api/waveforms/:bedId', (req, res) => {
    res.json(waveformBuffer.getLatestForBedIdVariants(req.params.bedId));
  });

  app.get('/api/quarantine', (_req, res) => {
    res.json({ unmappedSources: quarantine.list() });
  });

  app.get('/api/bed-map', (_req, res) => {
    res.json(getBedMap());
  });

  // Lets the "Connect a device" UI offer every registered adapter, without
  // hardcoding a duplicate list in the frontend that could drift out of
  // sync with adapters/registry.js. `protocol` tells the UI which TCP port
  // (HL7_PORT vs JSON_PORT) that device model actually needs to be pointed
  // at — JSON adapters are the ones that implement parseObservations.
  app.get('/api/device-types', (_req, res) => {
    res.json(Object.values(ADAPTERS).map((a) => ({
      deviceType: a.deviceType,
      protocol: a.parseObservations ? 'json' : 'hl7',
    })));
  });

  // Lets an admin map a device IP to a bed from the Hub UI instead of
  // hand-editing bed-map.json on the server. Also clears the IP from
  // quarantine, if it was there, since it's no longer "unmapped".
  // `deviceType` is optional — omitting it means the default adapter (BPL
  // VividVue M10, HL7); if given, it must be one adapters/registry.js
  // actually has registered, checked upfront so a typo fails loudly here
  // rather than silently falling back to the default adapter later.
  app.post('/api/bed-map', (req, res) => {
    const { ip, bedId, deviceType } = req.body || {};
    if (!ip || typeof ip !== 'string' || !bedId || typeof bedId !== 'string') {
      return res.status(400).json({ error: 'ip and bedId are required' });
    }
    if (deviceType && !ADAPTERS[deviceType]) {
      return res.status(400).json({ error: `Unknown deviceType "${deviceType}"`, knownDeviceTypes: Object.keys(ADAPTERS) });
    }
    const map = setMapping(ip.trim(), bedId.trim(), deviceType);
    quarantine.clear(ip.trim());
    console.log(`[bedMap] mapped ${ip.trim()} -> ${bedId.trim()}${deviceType ? ` (${deviceType})` : ''}`);
    res.status(201).json({ ip: ip.trim(), bedId: bedId.trim(), deviceType: deviceType || null, bedMap: map });
  });

  app.delete('/api/bed-map/:ip', (req, res) => {
    const map = removeMapping(req.params.ip);
    console.log(`[bedMap] removed mapping for ${req.params.ip}`);
    res.json({ removed: req.params.ip, bedMap: map });
  });

  // "Reload" doubles as a validation check — bed-map.json is already read
  // fresh on every connection (see bedMapping/bedMap.js), so this just
  // confirms the current file on disk parses cleanly and reports it back.
  app.post('/api/bed-map/reload', (_req, res) => {
    const map = getBedMap();
    res.json({ reloaded: true, entryCount: Object.keys(map).length, bedMap: map });
  });

  app.listen(env.HTTP_PORT, () => {
    console.log(`[http] device-ingestion admin API on http://0.0.0.0:${env.HTTP_PORT}`);
  });

  return app;
}

module.exports = { startHttpServer };
