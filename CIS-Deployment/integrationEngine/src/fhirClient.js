import { fromFhirPatient } from './normalize.js';
import { upsertPatient, audit } from './store.js';

export async function pullFhir(store, connection) {
  const base = connection.baseUrl.replace(/\/$/, '');
  const headers = { Accept: 'application/fhir+json, application/json' };
  if (connection.apiKey) headers.Authorization = `Bearer ${connection.apiKey}`;

  const started = Date.now();
  let patientBundle;
  try {
    const res = await fetch(`${base}/Patient`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`FHIR Patient HTTP ${res.status}`);
    patientBundle = await res.json();
  } catch (err) {
    audit(store, {
      channel: 'FHIR',
      action: 'PULL_FAILED',
      result: 'ERROR',
      detail: err.message,
      connectionId: connection.id,
    });
    throw err;
  }

  const entries = patientBundle.entry || [];
  const patients = entries.map((e) => e.resource).filter((r) => r?.resourceType === 'Patient');
  let synced = 0;

  for (const resource of patients) {
    let observations = [];
    try {
      const obsRes = await fetch(`${base}/Observation?patient=${encodeURIComponent(resource.id)}`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (obsRes.ok) {
        const obsBundle = await obsRes.json();
        observations = (obsBundle.entry || []).map((e) => e.resource).filter(Boolean);
      }
    } catch {
      /* observations optional */
    }

    // Hospital simulator may embed location on Patient extension
    const unitExt = resource.extension?.find((x) => x.url?.includes('unit'));
    const bedExt = resource.extension?.find((x) => x.url?.includes('bed'));
    resource._encounter = {
      unit: unitExt?.valueString || 'ICU',
      bed: bedExt?.valueString || '',
    };

    const normalized = fromFhirPatient(resource, observations);
    upsertPatient(store, normalized);
    synced += 1;
  }

  connection.lastSyncAt = new Date().toISOString();
  connection.lastSyncCount = synced;
  connection.status = 'connected';
  connection.lastError = null;
  connection.latencyMs = Date.now() - started;

  audit(store, {
    channel: 'FHIR',
    action: 'PULL_OK',
    result: 'OK',
    detail: `Synced ${synced} patients from ${base}`,
    connectionId: connection.id,
    hash: `fhir-${synced}-${connection.latencyMs}`,
  });

  return { synced, latencyMs: connection.latencyMs };
}
