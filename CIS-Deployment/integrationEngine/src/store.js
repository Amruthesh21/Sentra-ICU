import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const EMPTY = {
  connections: [],
  patients: {},
  buffer: [],
  audit: [],
};

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify(EMPTY, null, 2));
}

export function loadStore() {
  ensure();
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function saveStore(store) {
  ensure();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function audit(store, entry) {
  const row = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...entry,
  };
  store.audit.unshift(row);
  store.audit = store.audit.slice(0, 500);
  return row;
}

export function upsertPatient(store, patient) {
  const key = patient.mrn || patient.id;
  const prev = store.patients[key] || {};
  store.patients[key] = {
    ...prev,
    ...patient,
    id: key,
    updatedAt: new Date().toISOString(),
    history: [
      ...(patient.historyEvent ? [patient.historyEvent] : []),
      ...(prev.history || []),
    ].slice(0, 50),
  };
  delete store.patients[key].historyEvent;
  return store.patients[key];
}
