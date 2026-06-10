import { apiFetch } from './apiFetch';

const VITALS_BASE = '/api/vitals';
const CIS_BASE = '/api/cis';

const ENDPOINT_PATTERNS = (bedId) => [
  `${VITALS_BASE}/latest/${encodeURIComponent(bedId)}`,
  `${VITALS_BASE}/latest?bedId=${encodeURIComponent(bedId)}`,
  `${CIS_BASE}/vitals/latest?bedId=${encodeURIComponent(bedId)}`,
  `${CIS_BASE}/beds/${bedId}/vitals/latest`,
  `${CIS_BASE}/bed/${bedId}/vitals`,
  `${CIS_BASE}/historyVitals/latest?bedId=${bedId}`,
];

function normalizeVitals(data) {
  if (!data) return {};

  if (data.metadata && typeof data.metadata === 'object') {
    return normalizeVitals({ ...data, ...data.metadata });
  }

  if (data.primaryAttributes && Array.isArray(data.primaryAttributes)) {
    return attributesToMap(data.primaryAttributes, data.secondaryAttributes);
  }

  if (Array.isArray(data)) {
    if (data[0]?.primaryAttributes) {
      return attributesToMap(data[0].primaryAttributes, data[0].secondaryAttributes);
    }
    if (data[0]?.paramName) {
      return attributesToMap(data);
    }
  }

  if (data.vitals) {
    return normalizeVitals(data.vitals);
  }

  if (data.data) {
    return normalizeVitals(data.data);
  }

  return data;
}

function attributesToMap(primary, secondary) {
  const map = {};
  [...(primary || []), ...(secondary || [])].forEach((attr) => {
    const key = attr.paramName || attr.name;
    const raw = attr.value;
    if (key == null || raw == null || raw === '--' || raw === '') return;
    const num = typeof raw === 'number' ? raw : Number.parseFloat(raw);
    if (Number.isNaN(num)) return;
    map[key] = num;
    if (key === 'Pulse' || key === 'Heart Rate') map.HeartRate = num;
  });
  return map;
}

export async function fetchLatestVitals(bedId) {
  for (const url of ENDPOINT_PATTERNS(bedId)) {
    try {
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        const vitals = normalizeVitals(data);
        const timestamp = data.timestamp || new Date().toISOString();
        return {
          vitals,
          source: data.source || url,
          timestamp,
        };
      }
    } catch {
      // try next endpoint
    }
  }

  return { vitals: {}, source: null, timestamp: new Date().toISOString() };
}

export function getVitalStatus(value, paramName, thresholds) {
  if (value == null || !thresholds) return 'normal';

  const config = thresholds.find(
    (t) => t.paramName === paramName && t.enabled
  );
  if (!config) return 'normal';

  if (config.lowThreshold != null && value < config.lowThreshold) return 'critical';
  if (config.highThreshold != null && value > config.highThreshold) {
    return paramName === 'Temp1' ? 'warning' : 'critical';
  }
  return 'normal';
}

export function resolveVitalValue(vitals, paramName, aliases = []) {
  if (vitals[paramName] != null) return vitals[paramName];
  for (const alias of aliases) {
    if (vitals[alias] != null) return vitals[alias];
  }
  return null;
}

/** Clinical display formatting for vitals cards. */
export function formatVitalValue(paramName, value) {
  if (value == null || value === '--') return '--';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(n)) return '--';

  const name = paramName || '';
  if (name === 'SpO2' || name.startsWith('Temp')) return n.toFixed(1);
  if (name === 'Inf Vol' || name === 'Bolus Vol') return n.toFixed(2);
  if (name === 'Inf Rate') return n.toFixed(1);
  if (name === 'HeartRate' || name === 'Heart Rate' || name === 'Pulse'
      || name === 'Resp.Rate' || name === 'Bolus Rate') {
    return String(Math.round(n));
  }
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(1);
}
