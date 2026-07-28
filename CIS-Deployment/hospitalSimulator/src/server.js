import express from 'express';
import cors from 'cors';

const PORT = Number(process.env.PORT || 9080);
const PULSE_INGEST = process.env.PULSE_INGEST_URL || 'http://127.0.0.1:9070/ingest/hl7';
const PULSE_TOKEN = process.env.PULSE_INGEST_TOKEN || 'pulse-hospital-demo-token';

const PATIENTS = [
  {
    resourceType: 'Patient',
    id: 'pat-1001',
    identifier: [{ system: 'urn:hospital:mrn', value: 'MRN-88421' }],
    name: [{ family: 'Sharma', given: ['Aanya'] }],
    gender: 'female',
    birthDate: '1972-03-14',
    extension: [
      { url: 'https://pulse.icu/fhir/StructureDefinition/unit', valueString: 'ICU-1' },
      { url: 'https://pulse.icu/fhir/StructureDefinition/bed', valueString: 'BED-03' },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'pat-1002',
    identifier: [{ system: 'urn:hospital:mrn', value: 'MRN-77109' }],
    name: [{ family: 'Iyer', given: ['Rohan'] }],
    gender: 'male',
    birthDate: '1959-11-02',
    extension: [
      { url: 'https://pulse.icu/fhir/StructureDefinition/unit', valueString: 'ICU-2' },
      { url: 'https://pulse.icu/fhir/StructureDefinition/bed', valueString: 'BED-01' },
    ],
  },
  {
    resourceType: 'Patient',
    id: 'pat-1003',
    identifier: [{ system: 'urn:hospital:mrn', value: 'MRN-65002' }],
    name: [{ family: 'Nair', given: ['Meera'] }],
    gender: 'female',
    birthDate: '1985-07-21',
    extension: [
      { url: 'https://pulse.icu/fhir/StructureDefinition/unit', valueString: 'HDU' },
      { url: 'https://pulse.icu/fhir/StructureDefinition/bed', valueString: 'BED-07' },
    ],
  },
];

const OBS = {
  'pat-1001': [
    { resourceType: 'Observation', id: 'o1', code: { coding: [{ code: '8867-4', display: 'Heart rate' }] }, valueQuantity: { value: 78, unit: '/min' }, subject: { reference: 'Patient/pat-1001' } },
    { resourceType: 'Observation', id: 'o2', code: { coding: [{ code: '2708-6', display: 'SpO2' }] }, valueQuantity: { value: 97, unit: '%' }, subject: { reference: 'Patient/pat-1001' } },
    { resourceType: 'Observation', id: 'o1b', code: { coding: [{ code: '8480-6', display: 'Systolic BP' }] }, valueQuantity: { value: 118, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1001' } },
    { resourceType: 'Observation', id: 'o1c', code: { coding: [{ code: '8462-4', display: 'Diastolic BP' }] }, valueQuantity: { value: 74, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1001' } },
  ],
  'pat-1002': [
    { resourceType: 'Observation', id: 'o3', code: { coding: [{ code: '8867-4', display: 'Heart rate' }] }, valueQuantity: { value: 104, unit: '/min' }, subject: { reference: 'Patient/pat-1002' } },
    { resourceType: 'Observation', id: 'o4', code: { coding: [{ code: '2708-6', display: 'SpO2' }] }, valueQuantity: { value: 91, unit: '%' }, subject: { reference: 'Patient/pat-1002' } },
    { resourceType: 'Observation', id: 'o3b', code: { coding: [{ code: '8480-6', display: 'Systolic BP' }] }, valueQuantity: { value: 142, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1002' } },
    { resourceType: 'Observation', id: 'o3c', code: { coding: [{ code: '8462-4', display: 'Diastolic BP' }] }, valueQuantity: { value: 88, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1002' } },
  ],
  'pat-1003': [
    { resourceType: 'Observation', id: 'o5', code: { coding: [{ code: '8867-4', display: 'Heart rate' }] }, valueQuantity: { value: 128, unit: '/min' }, subject: { reference: 'Patient/pat-1003' } },
    { resourceType: 'Observation', id: 'o6', code: { coding: [{ code: '2708-6', display: 'SpO2' }] }, valueQuantity: { value: 88, unit: '%' }, subject: { reference: 'Patient/pat-1003' } },
    { resourceType: 'Observation', id: 'o7', code: { coding: [{ code: '8480-6', display: 'Systolic BP' }] }, valueQuantity: { value: 86, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1003' } },
    { resourceType: 'Observation', id: 'o8', code: { coding: [{ code: '8462-4', display: 'Diastolic BP' }] }, valueQuantity: { value: 52, unit: 'mmHg' }, subject: { reference: 'Patient/pat-1003' } },
  ],
};

function jitterVitals() {
  for (const list of Object.values(OBS)) {
    for (const o of list) {
      if (o.valueQuantity?.value != null) {
        const d = (Math.random() - 0.5) * 2;
        o.valueQuantity.value = Math.round((o.valueQuantity.value + d) * 10) / 10;
      }
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    service: 'hospital-simulator',
    status: 'ok',
    networkRole: 'HOSPITAL NETWORK',
    port: PORT,
    fhirBase: `http://127.0.0.1:${PORT}/fhir`,
    pulseIngest: PULSE_INGEST,
  });
});

app.get('/fhir/metadata', (_req, res) => {
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [{ mode: 'server', resource: [{ type: 'Patient' }, { type: 'Observation' }] }],
  });
});

app.get('/fhir/Patient', (_req, res) => {
  jitterVitals();
  res.json({
    resourceType: 'Bundle',
    type: 'searchset',
    total: PATIENTS.length,
    entry: PATIENTS.map((resource) => ({ resource })),
  });
});

app.get('/fhir/Patient/:id', (req, res) => {
  const p = PATIENTS.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', diagnostics: 'not found' }] });
  res.json(p);
});

app.get('/fhir/Observation', (req, res) => {
  jitterVitals();
  const patientRef = String(req.query.patient || '');
  const id = patientRef.replace('Patient/', '');
  const list = OBS[id] || [];
  res.json({
    resourceType: 'Bundle',
    type: 'searchset',
    total: list.length,
    entry: list.map((resource) => ({ resource })),
  });
});

function buildAdt({ mrn, family, given, unit, bed }) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const controlId = `HOSP${Date.now()}`;
  return [
    `MSH|^~\\&|HIS|ST-AURORA|PULSE|HUB|${ts}||ADT^A01|${controlId}|P|2.5`,
    `EVN|A01|${ts}`,
    `PID|1||${mrn}^^^HOSP^MR||${family}^${given}||19800101|F`,
    `PV1|1|I|${unit}^^${bed}||||`,
  ].join('\r');
}

function buildOru({ mrn, family, given, unit, bed, hr, spo2, sbp, dbp }) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const controlId = `ORU${Date.now()}`;
  return [
    `MSH|^~\\&|HIS|ST-AURORA|PULSE|HUB|${ts}||ORU^R01|${controlId}|P|2.5`,
    `PID|1||${mrn}^^^HOSP^MR||${family}^${given}`,
    `PV1|1|I|${unit}^^${bed}`,
    `OBR|1|||Vitals`,
    `OBX|1|NM|8867-4^HR||${hr}|/min`,
    `OBX|2|NM|2708-6^SpO2||${spo2}|%`,
    `OBX|3|NM|8480-6^NBP SYS||${sbp ?? 118}|mmHg`,
    `OBX|4|NM|8462-4^NBP DIA||${dbp ?? 74}|mmHg`,
  ].join('\r');
}

app.post('/simulate/push-hl7', async (req, res) => {
  const kind = req.body?.kind || 'ADT';
  const sample = req.body?.patient || {
    mrn: 'MRN-88421',
    family: 'Sharma',
    given: 'Aanya',
    unit: 'ICU-1',
    bed: 'BED-03',
    hr: 82,
    spo2: 96,
    sbp: 118,
    dbp: 74,
  };
  const message = kind === 'ORU' ? buildOru(sample) : buildAdt(sample);
  const target = req.body?.pulseIngestUrl || PULSE_INGEST;

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'x-application/hl7-v2+er7',
        Authorization: `Bearer ${PULSE_TOKEN}`,
      },
      body: message,
      signal: AbortSignal.timeout(8000),
    });
    const ackText = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        error: `Pulse ingest failed HTTP ${response.status}`,
        ackText,
        target,
        tip: 'Is Integration Engine running on the CLOUD network/port?',
      });
    }
    return res.json({
      ok: true,
      target,
      kind,
      message,
      ack: ackText,
      note: 'Hospital network pushed HL7 to PULSE cloud ingest',
    });
  } catch (err) {
    return res.status(502).json({
      error: err.message,
      target,
      tip: 'Different network failure simulation — Pulse cloud unreachable from hospital',
    });
  }
});

app.post('/simulate/push-device', async (req, res) => {
  const target = (req.body?.pulseDeviceUrl) || 'http://127.0.0.1:9070/ingest/device';
  const payload = req.body?.payload || {
    mrn: 'MRN-65002',
    fullName: 'Meera Nair',
    unit: 'HDU',
    bed: 'BED-07',
    vitals: { hr: 130, spo2: 87, sbp: 84, dbp: 52, rr: 30 },
  };
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PULSE_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error || response.status, target });
    return res.json({ ok: true, target, data });
  } catch (err) {
    return res.status(502).json({ error: err.message, target });
  }
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head><title>Hospital Simulator</title>
<style>
body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#0b1220;background:#f3f4f6}
.card{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:16px;margin:12px 0}
button{background:#0b1220;color:#fff;border:0;padding:10px 14px;border-radius:4px;cursor:pointer;margin-right:8px}
code{background:#eef1f5;padding:2px 6px;border-radius:4px}
pre{background:#0b1220;color:#d1fae5;padding:12px;overflow:auto;border-radius:6px;font-size:12px}
</style></head><body>
<h1>Hospital Network Simulator</h1>
<p>This process pretends to be <strong>hospital IT systems</strong> on a separate network/port from PULSE cloud.</p>
<div class="card">
  <p>FHIR base: <code>http://127.0.0.1:${PORT}/fhir</code></p>
  <p>Pulse ingest target: <code>${PULSE_INGEST}</code></p>
  <button onclick="push('ADT')">Push HL7 ADT (admit)</button>
  <button onclick="push('ORU')">Push HL7 ORU (vitals)</button>
  <button onclick="device()">Push device vitals</button>
</div>
<pre id="out">Ready.</pre>
<script>
async function push(kind){
  out.textContent='Sending '+kind+'...';
  const r=await fetch('/simulate/push-hl7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})});
  out.textContent=JSON.stringify(await r.json(),null,2);
}
async function device(){
  out.textContent='Sending device...';
  const r=await fetch('/simulate/push-device',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  out.textContent=JSON.stringify(await r.json(),null,2);
}
</script>
</body></html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hospital Simulator (HOSPITAL NETWORK) on http://0.0.0.0:${PORT}`);
  console.log(`FHIR:  http://127.0.0.1:${PORT}/fhir`);
  console.log(`UI:    http://127.0.0.1:${PORT}/`);
});
