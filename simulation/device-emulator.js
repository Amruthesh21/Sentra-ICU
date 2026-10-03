#!/usr/bin/env node
/**
 * Sentra ICU — device emulator
 * ------------------------------
 * Makes THIS machine act like a real bedside device on the network — same
 * idea as the original device-simulation jar (connect out to the
 * server, replay a real captured export), just built into this repo's own
 * zero-dependency tooling instead of a separate Java jar.
 *
 * Point it at a running Sentra ICU deployment's IP and it opens a TCP
 * connection to deviceIngestion's HL7 (or JSON) device port and streams a
 * real captured device export on a loop for as long as it keeps running —
 * Ctrl+C to stop. Nothing here is baked into the application: it only ever
 * talks to deviceIngestion's real, public device port, the same one an
 * actual monitor would connect to. Lives entirely outside the app, same
 * as simulate.js.
 *
 * Once it's running, map it to a bed from the Hub UI: Admin -> "Connect a
 * device". This tool tries to auto-detect and print the IP deviceIngestion
 * actually saw the connection from (via the same quarantine-list trick
 * simulate.js uses) so you know exactly what to enter — best-effort only,
 * since it needs the Hub's own login API to be reachable too; if that
 * fails for any reason (different network, Hub down, whatever) the device
 * stream itself is unaffected, and you can always find the IP from the
 * Hub UI's own unmapped-sources list instead.
 *
 * Usage:
 *   node device-emulator.js --host 192.168.1.50
 *   node device-emulator.js --host 192.168.1.50 --device BplAcuraS1
 *   node device-emulator.js --list
 *   node device-emulator.js --host 192.168.1.50 --port 7061 --interval 2000
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.resolve(__dirname, '../CIS-Deployment/deviceIngestion/test/fixtures');
const CONFIG_PATH = path.join(__dirname, 'config.json');

// deviceType (exactly what alarmEngine/deviceIngestion's adapters/registry.js
// registers each adapter under) -> which real captured fixture to replay and
// which protocol port it needs. "no waveform" devices are exactly the ones
// this session confirmed never carry ECG/pleth/resp CD+NA segments — showing
// "No signal" on those traces in the Hub is correct behavior, not a bug.
const DEVICES = {
  BplVividVueM10: { protocol: 'hl7', fixture: 'sample-demo-mode.hl7', label: 'BPL VividVue M10 patient monitor — full 12-lead ECG + pleth + resp waveforms' },
  BplAcuraS1: { protocol: 'hl7', fixture: 'sample-bpl-acura-s1.hl7', label: 'BPL Acura S1 syringe pump — no waveform' },
  AviIW6000: { protocol: 'hl7', fixture: 'sample-avi-iw6000.hl7', label: 'AVI IW6000' },
  AviVihaDV10: { protocol: 'hl7', fixture: 'sample-avi-viha-dv10.hl7', label: 'AVI Viha DV10' },
  BplPenlon320: { protocol: 'hl7', fixture: 'sample-bpl-penlon-320.hl7', label: 'BPL Penlon 320 anesthesia workstation — no waveform' },
  BplVividVue12: { protocol: 'hl7', fixture: 'sample-bpl-vividvue-12.hl7', label: 'BPL VividVue 12 patient monitor' },
  G40: { protocol: 'hl7', fixture: 'sample-g40.hl7', label: 'G40' },
  MindrayBeneviewT5: { protocol: 'hl7', fixture: 'sample-mindray-beneview-t5.hl7', label: 'Mindray BeneView T5 patient monitor' },
  PVM2703: { protocol: 'hl7', fixture: 'sample-pvm2703.hl7', label: 'PVM2703' },
  SchillerNeumovent: { protocol: 'hl7', fixture: 'sample-schiller-neumovent.hl7', label: 'Schiller Neumovent ventilator — no waveform' },
  VmDevice: { protocol: 'hl7', fixture: 'sample-vm-device.hl7', label: 'VM Device' },
  IntelliVue: { protocol: 'json', fixture: 'sample-intellivue.json', label: 'Philips IntelliVue patient monitor (JSON protocol)' },
  EvitaV600: { protocol: 'json', fixture: 'sample-evita-v600.json', label: 'Draeger Evita V600 ventilator — no waveform (JSON protocol)' },
  MX550: { protocol: 'json', fixture: 'sample-mx550.json', label: 'Philips MX550 patient monitor (JSON protocol)' },
  DraegerSavina300: { protocol: 'json', fixture: 'sample-draeger-savina-300.json', label: 'Draeger Savina 300 ventilator — no waveform (JSON protocol)' },
};

const DEFAULT_DEVICE = 'BplVividVueM10';
const DEFAULT_PORTS = { hl7: 7061, json: 7062, hub: 7040 };
const DEFAULT_INTERVAL_MS = 2000; // how often the whole message set repeats — keeps
// deviceIngestion's waveform buffer fresh at roughly the cadence a real
// monitor re-batches its own waveform segments (see WaveformCanvas.jsx).

function log(msg) { console.log(msg); }
function fail(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

function parseArgs(argv) {
  const args = { device: DEFAULT_DEVICE, interval: DEFAULT_INTERVAL_MS, detect: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list' || a === '-l') args.list = true;
    else if (a === '--host' || a === '-h') args.host = argv[++i];
    else if (a === '--port' || a === '-p') args.port = Number(argv[++i]);
    else if (a === '--device' || a === '-d') args.device = argv[++i];
    else if (a === '--interval' || a === '-i') args.interval = Number(argv[++i]);
    else if (a === '--no-detect') args.detect = false;
    else if (a === '--help') args.help = true;
  }
  return args;
}

function printHelp() {
  log(`Sentra ICU device emulator

Usage:
  node device-emulator.js --host <sentraicu-ip> [options]
  node device-emulator.js --list

Options:
  --host, -h <ip>       Sentra ICU server's IP or hostname (required, unless --list)
  --device, -d <type>   Device to emulate (default: ${DEFAULT_DEVICE})
  --port, -p <n>        Override the device port (default: 7061 HL7 / 7062 JSON, by device)
  --interval, -i <ms>   How often to re-send the full message set (default: ${DEFAULT_INTERVAL_MS})
  --no-detect           Skip the best-effort "which IP did the server see me as" check
  --list, -l            List every device this tool can emulate
  --help                Show this help
`);
}

function printDeviceList() {
  log('Devices this tool can emulate:\n');
  for (const [type, d] of Object.entries(DEVICES)) {
    log(`  ${type.padEnd(20)} [${d.protocol.toUpperCase().padEnd(4)}]  ${d.label}`);
  }
  log(`\nDefault: ${DEFAULT_DEVICE}`);
}

function loadHl7Messages(fixture) {
  const p = path.join(FIXTURES_DIR, fixture);
  if (!fs.existsSync(p)) fail(`Fixture not found: ${p}`);
  const raw = fs.readFileSync(p, 'utf8');
  return raw.split(/(?=^MSH\|)/m).map((m) => m.trim()).filter(Boolean);
}

function loadJsonMessages(fixture) {
  const p = path.join(FIXTURES_DIR, fixture);
  if (!fs.existsSync(p)) fail(`Fixture not found: ${p}`);
  // One complete JSON object per fixture file — jsonFraming.js on the
  // server detects message boundaries by brace-depth, so sending this text
  // back-to-back on a loop is exactly what a real JSON-speaking device's
  // repeated status updates look like on the wire.
  return [fs.readFileSync(p, 'utf8').trim()];
}

/**
 * Opens one TCP connection and streams `messages` on a loop until the
 * process exits, reconnecting with backoff if the connection drops (the
 * server restarting, a network blip) — a real device left running
 * wouldn't just give up.
 */
function streamForever(host, port, messages, intervalMs) {
  let backoffMs = 1000;
  let stopped = false;

  function connectOnce() {
    if (stopped) return;
    const socket = net.connect(port, host, () => {
      log(`  Connected to ${host}:${port}. Streaming ${messages.length} message(s) every ${intervalMs}ms — Ctrl+C to stop.`);
      backoffMs = 1000;
      sendLoop(socket);
    });

    let loopTimer = null;
    function sendLoop(sock) {
      let i = 0;
      function sendNext() {
        if (sock.destroyed) return;
        sock.write(messages[i] + '\r\n');
        i = (i + 1) % messages.length;
        const gap = i === 0 ? intervalMs : 150; // pace within a batch like simulate.js; pause between full cycles
        loopTimer = setTimeout(sendNext, gap);
      }
      sendNext();
    }

    socket.on('error', (err) => {
      log(`  Connection error: ${err.message} — retrying in ${backoffMs / 1000}s...`);
    });
    socket.on('close', () => {
      if (loopTimer) clearTimeout(loopTimer);
      if (stopped) return;
      setTimeout(connectOnce, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 15000);
    });
  }

  connectOnce();
  return () => { stopped = true; };
}

async function apiCall(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

/** Same login flow as simulate.js's loginHospitalAdmin(), minus the loud
 * failures — this is best-effort, so any failure just returns null instead
 * of stopping the device stream. Handles MFA only when the server is in
 * dev-expose-otp mode (it hands the code back directly); otherwise gives up
 * quietly rather than guessing at a code. */
async function loginBestEffort(hubUrl, config) {
  const login = await apiCall(`${hubUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.hospitalAdminEmail, password: config.hospitalAdminPassword }),
  });
  if (login.data?.accessToken) return login.data.accessToken;
  if (!login.data?.mfaToken || !login.data?.devOtp) return null;

  const verify = await apiCall(`${hubUrl}/api/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken: login.data.mfaToken, code: login.data.devOtp, method: 'email' }),
  });
  return verify.data?.accessToken || null;
}

/** Best-effort only — logs in with the demo hospital-admin account (same
 * one simulate.js uses, from config.json) and checks deviceIngestion's
 * quarantine list for a source IP that showed up after this tool started
 * streaming. Never fatal: the device stream itself doesn't depend on this. */
async function tryAutoDetectIp(host, hubPort) {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  let config;
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }

  const hubUrl = `http://${host}:${hubPort}`;
  const token = await loginBestEffort(hubUrl, config);
  if (!token) return null;

  const proxyUrl = `${hubUrl}/device-ingestion`;
  const q = await apiCall(`${proxyUrl}/api/quarantine`, { headers: { Authorization: `Bearer ${token}` } });
  if (!q.ok) return null;
  const sources = q.data.unmappedSources || [];
  // Most-recently-seen unmapped source is the best guess for "this tool" —
  // good enough for a single-device demo/test setup, not a claim of
  // certainty on a busy network with several unmapped devices at once.
  return sources.length ? sources[sources.length - 1].ip : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.list) return printDeviceList();
  if (!args.host) {
    printHelp();
    fail('--host is required (the Sentra ICU server\'s IP or hostname).');
  }

  const deviceType = args.device;
  const device = DEVICES[deviceType];
  if (!device) {
    log(`Unknown device "${deviceType}".\n`);
    printDeviceList();
    process.exit(1);
  }

  const port = args.port || DEFAULT_PORTS[device.protocol];
  const messages = device.protocol === 'hl7'
    ? loadHl7Messages(device.fixture)
    : loadJsonMessages(device.fixture);

  log('=== Sentra ICU device emulator ===\n');
  log(`  Emulating: ${deviceType} — ${device.label}`);
  log(`  Target:    ${args.host}:${port} (${device.protocol.toUpperCase()})`);
  log(`  Fixture:   ${device.fixture} (real captured export, not synthetic)\n`);

  const stop = streamForever(args.host, port, messages, args.interval);

  if (args.detect) {
    setTimeout(async () => {
      log('\n  Checking which IP the server saw this connection from...');
      const ip = await tryAutoDetectIp(args.host, DEFAULT_PORTS.hub);
      if (ip) {
        log(`  -> ${ip}`);
        log(`  In the Hub: Admin -> "Connect a device" -> map ${ip} to a bed.\n`);
      } else {
        log('  Could not auto-detect (Hub unreachable, different network, or already mapped).');
        log('  Check the Hub UI\'s "Connect a device" panel directly instead.\n');
      }
    }, 1500);
  }

  process.on('SIGINT', () => {
    log('\nStopping...');
    stop();
    process.exit(0);
  });
}

main().catch((err) => fail(err.message || String(err)));
