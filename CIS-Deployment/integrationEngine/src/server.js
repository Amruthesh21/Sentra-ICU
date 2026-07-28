import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { loadStore, saveStore, audit, upsertPatient } from './store.js';
import { parseHl7, buildAck } from './hl7.js';
import { fromHl7, matchIdentity } from './normalize.js';
import { pullFhir } from './fhirClient.js';

const PORT = Number(process.env.PORT || 9070);
const INGEST_TOKEN = process.env.PULSE_INGEST_TOKEN || 'pulse-hospital-demo-token';

const app = express();
app.use(cors());
app.use(express.text({ type: ['text/*', 'application/hl7-v2', 'x-application/hl7-v2+er7'], limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

function requireIngestAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-api-key'];
  if (token !== INGEST_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — hospital must send Bearer token / x-api-key' });
  }
  return next();
}

app.get('/health', (_req, res) => {
  res.json({
    service: 'pulse-integration-engine',
    status: 'ok',
    port: PORT,
    ingestTokenHint: 'pulse-hospital-demo-token',
    hl7Ingest: `POST http://<cloud-host>:${PORT}/ingest/hl7`,
    fhirConnect: `POST http://<cloud-host>:${PORT}/connections/fhir`,
  });
});

function recentChannel(store, channel, withinMs = 5 * 60 * 1000) {
  const now = Date.now();
  return store.audit.some((a) => {
    if (String(a.channel || '').toUpperCase() !== channel) return false;
    const t = new Date(a.ts).getTime();
    return Number.isFinite(t) && now - t < withinMs;
  });
}

app.get('/status', (_req, res) => {
  const store = loadStore();
  const patients = Object.values(store.patients);
  const fhirConnected = store.connections.some(
    (c) => c.type === 'FHIR' && c.status === 'connected',
  );
  const fhirFresh = store.connections.some((c) => {
    if (c.type !== 'FHIR' || c.status !== 'connected' || !c.lastSyncAt) return false;
    return Date.now() - new Date(c.lastSyncAt).getTime() < 5 * 60 * 1000;
  });
  res.json({
    engine: 'online',
    networkRole: 'CLOUD (PULSE)',
    connections: store.connections,
    patientCount: patients.length,
    bufferDepth: store.buffer.length,
    auditCount: store.audit.length,
    lastAuditAt: store.audit[0]?.ts || null,
    capabilities: {
      // Supported by engine (always available when online)
      hl7: true,
      fhir: true,
      deviceAdapters: true,
      authEncryption: true,
      retryBuffering: true,
      loggingAuditing: true,
      normalization: true,
      identityMatching: true,
      // Activity / freshness (UI should prefer these for "Live")
      hl7Active: recentChannel(store, 'HL7'),
      fhirConnected,
      fhirFresh,
      deviceActive: recentChannel(store, 'DEVICE'),
      bufferHasFailed: store.buffer.some((b) => b.status === 'failed'),
    },
    endpoints: {
      hl7Ingest: `/ingest/hl7`,
      fhirConnections: `/connections/fhir`,
      patients: `/patients`,
      audit: `/audit`,
      bufferReplay: `/buffer/replay`,
    },
  });
});

app.get('/connections', (_req, res) => {
  res.json(loadStore().connections);
});

app.post('/connections/fhir', async (req, res) => {
  const store = loadStore();
  const { name, baseUrl, apiKey } = req.body || {};
  if (!baseUrl) return res.status(400).json({ error: 'baseUrl required (hospital FHIR root)' });

  const connection = {
    id: crypto.randomUUID(),
    type: 'FHIR',
    name: name || 'Hospital FHIR',
    baseUrl: String(baseUrl).replace(/\/$/, ''),
    apiKey: apiKey || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    lastSyncCount: 0,
    lastError: null,
    latencyMs: null,
  };
  store.connections.push(connection);
  audit(store, {
    channel: 'FHIR',
    action: 'CONNECTION_CREATED',
    result: 'PENDING',
    detail: `Target ${connection.baseUrl}`,
    connectionId: connection.id,
  });
  saveStore(store);

  try {
    const result = await pullFhir(store, connection);
    saveStore(store);
    return res.json({ connection, ...result, message: 'FHIR connected and first sync completed' });
  } catch (err) {
    connection.status = 'error';
    connection.lastError = err.message;
    saveStore(store);
    return res.status(502).json({
      connection,
      error: err.message,
      tip: 'Start hospital simulator on another port/machine and use its FHIR URL',
    });
  }
});

app.post('/connections/:id/sync', async (req, res) => {
  const store = loadStore();
  const connection = store.connections.find((c) => c.id === req.params.id);
  if (!connection) return res.status(404).json({ error: 'Connection not found' });
  if (connection.type !== 'FHIR') return res.status(400).json({ error: 'Only FHIR connections sync this way' });

  try {
    const result = await pullFhir(store, connection);
    saveStore(store);
    return res.json({ connection, ...result });
  } catch (err) {
    connection.status = 'error';
    connection.lastError = err.message;
    saveStore(store);
    return res.status(502).json({ connection, error: err.message });
  }
});

app.delete('/connections/:id', (req, res) => {
  const store = loadStore();
  store.connections = store.connections.filter((c) => c.id !== req.params.id);
  audit(store, { channel: 'SYSTEM', action: 'CONNECTION_DELETED', result: 'OK', detail: req.params.id });
  saveStore(store);
  res.json({ ok: true });
});

/** Hospital pushes HL7 to PULSE cloud */
app.post('/ingest/hl7', requireIngestAuth, (req, res) => {
  const store = loadStore();
  const raw = typeof req.body === 'string' ? req.body : req.body?.message;
  if (!raw || !String(raw).includes('MSH|')) {
    return res.status(400).json({ error: 'HL7 body required (pipe-delimited ER7 starting with MSH|)' });
  }

  try {
    const parsed = parseHl7(raw);
    const normalized = fromHl7(parsed);
    const identity = matchIdentity(store, normalized);
    const saved = upsertPatient(store, {
      ...normalized,
      identityMatch: identity,
    });

    store.buffer.push({
      id: crypto.randomUUID(),
      channel: 'HL7',
      controlId: parsed.controlId,
      receivedAt: new Date().toISOString(),
      status: 'processed',
      mrn: parsed.mrn,
    });
    store.buffer = store.buffer.slice(-200);

    audit(store, {
      channel: 'HL7',
      action: parsed.messageType,
      result: 'OK',
      detail: `${parsed.fullName} ${parsed.unit} ${parsed.bed} · ${identity.strategy}`,
      hash: crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0, 12),
    });
    saveStore(store);

    const ack = buildAck(parsed.controlId, 'AA');
    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json({ ack, patient: saved, identity });
    }
    return res.type('x-application/hl7-v2+er7').send(ack);
  } catch (err) {
    audit(store, { channel: 'HL7', action: 'PARSE_FAILED', result: 'ERROR', detail: err.message });
    store.buffer.push({
      id: crypto.randomUUID(),
      channel: 'HL7',
      receivedAt: new Date().toISOString(),
      status: 'failed',
      error: err.message,
      rawPreview: String(raw).slice(0, 200),
    });
    saveStore(store);
    res.status(400).json({ error: err.message });
  }
});

/** Same ingest but always JSON (for Hub UI test button) */
app.post('/ingest/hl7/json', requireIngestAuth, (req, res) => {
  const store = loadStore();
  const raw = req.body?.message;
  if (!raw) return res.status(400).json({ error: 'message required' });
  try {
    const parsed = parseHl7(raw);
    const normalized = fromHl7(parsed);
    const identity = matchIdentity(store, normalized);
    const saved = upsertPatient(store, { ...normalized, identityMatch: identity });
    audit(store, {
      channel: 'HL7',
      action: parsed.messageType,
      result: 'OK',
      detail: `${parsed.fullName} · identity ${identity.strategy}`,
      hash: crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0, 12),
    });
    saveStore(store);
    res.json({
      ack: buildAck(parsed.controlId),
      patient: saved,
      identity,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/patients', (_req, res) => {
  const patients = Object.values(loadStore().patients).sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
  res.json(patients);
});

app.get('/audit', (_req, res) => {
  res.json(loadStore().audit.slice(0, 100));
});

app.get('/buffer', (_req, res) => {
  res.json(loadStore().buffer.slice().reverse());
});

app.post('/buffer/replay', (_req, res) => {
  const store = loadStore();
  const failed = store.buffer.filter((b) => b.status === 'failed');
  for (const item of failed) {
    item.status = 'requeued';
    item.replayedAt = new Date().toISOString();
  }
  audit(store, {
    channel: 'BUFFER',
    action: 'REPLAY',
    result: 'OK',
    detail: `Requeued ${failed.length} failed messages`,
  });
  saveStore(store);
  res.json({ requeued: failed.length });
});

/** Device adapter stub — hospital posts device vitals JSON */
app.post('/ingest/device', requireIngestAuth, (req, res) => {
  const store = loadStore();
  const { mrn, fullName, unit, bed, vitals } = req.body || {};
  if (!mrn) return res.status(400).json({ error: 'mrn required' });
  const saved = upsertPatient(store, {
    mrn,
    fullName: fullName || mrn,
    unit: unit || 'ICU',
    bed: bed || '',
    vitals: vitals || {},
    source: 'DEVICE_ADAPTER',
    status: 'live',
    historyEvent: { at: new Date().toISOString(), event: 'Device adapter vitals', channel: 'DEVICE' },
  });
  audit(store, {
    channel: 'DEVICE',
    action: 'VITALS',
    result: 'OK',
    detail: `${mrn} ${bed}`,
  });
  saveStore(store);
  res.json({ patient: saved });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PULSE Integration Engine (CLOUD) on http://0.0.0.0:${PORT}`);
  console.log(`HL7 ingest:  POST /ingest/hl7  (Bearer ${INGEST_TOKEN})`);
  console.log(`FHIR connect: POST /connections/fhir { baseUrl }`);
});
