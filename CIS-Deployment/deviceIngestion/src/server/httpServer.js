/**
 * Admin/health HTTP API. Not the device-facing interface (that's
 * tcpServer.js) — this is for operators/dashboards to see what the service
 * is doing.
 */

const express = require('express');
const env = require('../env');
const { getBedMap } = require('../bedMapping/bedMap');
const quarantine = require('../bedMapping/quarantine');
const waveformBuffer = require('../waveform/waveformBuffer');
const { getBedStatus } = require('./tcpServer');

function startHttpServer() {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'device-ingestion' });
  });

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

  app.get('/api/quarantine', (_req, res) => {
    res.json({ unmappedSources: quarantine.list() });
  });

  app.get('/api/bed-map', (_req, res) => {
    res.json(getBedMap());
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
