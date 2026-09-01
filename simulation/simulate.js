#!/usr/bin/env node
/**
 * Sentra ICU — standalone simulation tool
 * ------------------------------------------
 * Lives entirely OUTSIDE the application's own code and database. Nothing
 * here is baked into any service's source, boot sequence, or seed data —
 * every run creates its test data fresh, on demand, through the exact same
 * public APIs a real user would use (login, admission, device HL7 port).
 * Delete this whole folder and the running application is completely
 * unaffected.
 *
 * The "device data" it sends is not synthetic either — it replays a real
 * captured HL7 export from an actual BPL VividVue M10 monitor (the same
 * fixture already used by deviceIngestion's own automated tests), referenced
 * from its one real location rather than copied here.
 *
 * Usage:
 *   node simulate.js          admit the simulation patient + replay device data
 *   node simulate.js --reset  discharge the simulation patient (cleanup)
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const mode = process.argv.includes('--reset') ? 'reset' : 'run';

function log(msg) {
  console.log(msg);
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function apiCall(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    fail(
      `Could not reach ${url}\n\n` +
      `  ${err.message}\n\n` +
      `Is the application actually running? See CIS-Deployment/deviceIngestion/docs/RUNBOOK.md\n` +
      `to bring the stack up, then try again.`
    );
  }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function loginHospitalAdmin() {
  log(`Logging in as ${config.hospitalAdminEmail} ...`);
  const login = await apiCall(`${config.hubApiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.hospitalAdminEmail, password: config.hospitalAdminPassword }),
  });
  if (!login.ok) fail(`Login failed: ${login.data.error || login.status}`);

  if (login.data.accessToken) {
    return login.data.accessToken; // MFA already trusted
  }
  if (login.data.mfaToken) {
    // Dev-mode: the server exposes the code directly when configured that
    // way (HUB_AUTH_DEV_EXPOSE_OTP=true). No code is fabricated here — if
    // the server didn't hand one back, this fails loudly instead of
    // guessing at "123456".
    const code = login.data.devOtp;
    if (!code) {
      fail(
        'Login requires an MFA code, and the server is not in dev-expose-otp ' +
        'mode, so this tool has no way to obtain it automatically. Log in ' +
        'once through the Hub UI to establish a trusted session, then re-run.'
      );
    }
    const verify = await apiCall(`${config.hubApiUrl}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: login.data.mfaToken, code, method: 'email' }),
    });
    if (!verify.ok || !verify.data.accessToken) fail(`MFA verification failed: ${verify.data.error || verify.status}`);
    return verify.data.accessToken;
  }
  fail('Unexpected login response — did the auth API change shape?');
}

function loadHl7Messages() {
  const fixturePath = path.resolve(__dirname, config.fixtureFile);
  if (!fs.existsSync(fixturePath)) {
    fail(`Fixture file not found: ${fixturePath}`);
  }
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return raw.split(/(?=^MSH\|)/m).map((m) => m.trim()).filter(Boolean);
}

/** Opens a TCP connection, sends the given messages 1/sec, then closes. */
function sendHl7(messages) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(config.hl7Port, config.hl7Host, () => {
      let i = 0;
      const timer = setInterval(() => {
        if (i >= messages.length) {
          clearInterval(timer);
          socket.end();
          return;
        }
        socket.write(messages[i] + '\r\n');
        i += 1;
      }, 150);
    });
    socket.on('error', reject);
    socket.on('close', resolve);
  });
}

async function findQuarantinedIp(token, before) {
  const res = await apiCall(`${config.deviceIngestionProxyUrl}/api/quarantine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const sources = res.data.unmappedSources || [];
  const beforeIps = new Set((before || []).map((s) => s.ip));
  const fresh = sources.find((s) => !beforeIps.has(s.ip)) || sources[0];
  return fresh ? fresh.ip : null;
}

async function ensureDeviceMapped(token) {
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const beforeRes = await apiCall(`${config.deviceIngestionProxyUrl}/api/quarantine`, { headers: authHeaders });
  const before = beforeRes.ok ? beforeRes.data.unmappedSources : [];

  const bedMapRes = await apiCall(`${config.deviceIngestionProxyUrl}/api/bed-map`, { headers: authHeaders });
  const alreadyMapped = bedMapRes.ok
    && Object.values(bedMapRes.data || {}).some((v) => v === config.targetBedLabel);
  if (alreadyMapped) {
    log(`  Device already connected to ${config.targetBedLabel} — skipping mapping step.`);
    return;
  }

  log('  Probing to discover this machine\'s source IP as device-ingestion sees it...');
  const messages = loadHl7Messages();
  await sendHl7([messages[0]]); // one message is enough to register in quarantine

  await new Promise((r) => setTimeout(r, 500));
  const ip = await findQuarantinedIp(token, before);
  if (!ip) {
    fail(
      'Could not auto-detect the source IP to map. Map it manually once via ' +
      'the Hub: Admin -> "Connect a device", then re-run this tool.'
    );
  }

  log(`  Connecting ${ip} -> ${config.targetBedLabel} ...`);
  const map = await apiCall(`${config.deviceIngestionProxyUrl}/api/bed-map`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ip, bedId: config.targetBedLabel }),
  });
  if (!map.ok) fail(`Failed to map device: ${map.data.error || map.status}`);
}

async function admitSimulationPatient(token) {
  const p = config.simulationPatient;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  log(`Admitting "${p.fullName}" (MRN ${p.mrn}) to ${config.targetBedLabel} ...`);
  const res = await apiCall(`${config.hubApiUrl}/api/hub/admissions/admit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ bedLabel: config.targetBedLabel, ...p }),
  });
  if (res.ok) {
    log('  Admitted.');
    return;
  }

  const msg = String(res.data.error || '');
  if (msg.includes('Bed is occupied')) {
    // Someone (possibly this same simulation patient) is already on this
    // bed with an active visit right now — genuinely nothing to do.
    log('  Bed already occupied — continuing.');
    return;
  }
  if (msg.includes('MRN already exists')) {
    // This exact MRN was admitted before and later discharged — the patient
    // record persists (real hospitals keep history), so this needs a
    // readmission, not a fresh admit.
    log('  This MRN was admitted before — readmitting instead...');
    const search = await apiCall(
      `${config.hubApiUrl}/api/hub/admissions/patients/search?q=${encodeURIComponent(p.mrn)}`,
      { headers: authHeaders },
    );
    const match = (search.ok ? search.data : []).find((pt) => pt.mrn === p.mrn);
    if (!match) fail(`Could not find existing patient record for MRN ${p.mrn} to readmit.`);

    const readmit = await apiCall(`${config.hubApiUrl}/api/hub/admissions/readmit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ bedLabel: config.targetBedLabel, patientId: match.patientId, ...p }),
    });
    if (readmit.ok) {
      log('  Readmitted.');
      return;
    }
    const readmitMsg = String(readmit.data.error || '');
    if (readmitMsg.includes('Bed is occupied')) {
      log('  Bed already occupied — continuing.');
      return;
    }
    fail(`Readmission failed: ${readmitMsg || readmit.status}`);
  }
  fail(`Admission failed: ${msg || res.status}`);
}

async function dischargeSimulationPatient(token) {
  log(`Discharging ${config.targetBedLabel} ...`);
  const res = await apiCall(`${config.hubApiUrl}/api/hub/admissions/discharge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bedLabel: config.targetBedLabel }),
  });
  if (res.ok) {
    log('  Discharged. Bed is free again.');
    return;
  }
  const msg = String(res.data.error || '');
  if (msg.includes('No active patient')) {
    log('  Already vacant — nothing to do.');
    return;
  }
  fail(`Discharge failed: ${msg || res.status}`);
}

async function runSimulation() {
  log('=== Sentra ICU simulation ===\n');
  const token = await loginHospitalAdmin();

  await admitSimulationPatient(token);

  log('Connecting the simulated device...');
  await ensureDeviceMapped(token);

  log('Replaying real captured device data (BPL VividVue M10 export)...');
  const messages = loadHl7Messages();
  await sendHl7(messages);
  log(`  Sent ${messages.length} HL7 messages.`);

  log('\n✓ Done.');
  log(`  Hub:   http://localhost:7040/bed/ICU-1-${config.targetBedLabel}`);
  log('  Login: doctor@sentraicu.local / DoctorDemo@2026 (or your own account)');
  log('\n  Run again any time to refresh the vitals. Run with --reset to discharge.');
}

async function runReset() {
  log('=== Sentra ICU simulation — reset ===\n');
  const token = await loginHospitalAdmin();
  await dischargeSimulationPatient(token);
  log('\n✓ Reset complete.');
}

(mode === 'reset' ? runReset() : runSimulation()).catch((err) => {
  fail(err.message || String(err));
});
