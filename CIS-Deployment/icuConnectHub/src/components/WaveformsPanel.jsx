import WaveformCanvas from './WaveformCanvas';
import { formatVitalValue, normalizeParamName } from '../api/hub';

function resolve(vitals, key, aliases = []) {
  if (vitals[key] != null) return vitals[key];
  for (const a of aliases) {
    if (vitals[a] != null) return vitals[a];
  }
  return null;
}

function hasParam(deviceStatus, ...names) {
  const available = deviceStatus?.availableParameters || [];
  return names.some((name) =>
    available.some((p) => p === name || normalizeParamName(p) === normalizeParamName(name))
  );
}

function hasLive(vitals, key, aliases = []) {
  const v = resolve(vitals, key, aliases);
  return v != null && !Number.isNaN(v);
}

const ECG_CHANNELS = [
  { id: 'ecg1', label: 'ECG 1', ecgLead: 1 },
  { id: 'ecg2', label: 'ECG 2', ecgLead: 2 },
  { id: 'ecg3', label: 'ECG 3', ecgLead: 3 },
];

export default function WaveformsPanel({ vitals, deviceStatus, patient }) {
  const hr = resolve(vitals, 'HeartRate', ['Pulse', 'Heart Rate']);
  const spo2 = resolve(vitals, 'SpO2', []);
  const rr = resolve(vitals, 'Resp.Rate', ['Resp.Rate']);
  const pulse = resolve(vitals, 'Pulse', ['Heart Rate', 'HeartRate']);

  const monitorReady =
    deviceStatus?.virtualSimulatorActive ||
    deviceStatus?.simulatorConnected ||
    (deviceStatus?.availableParameters?.length > 0);

  const ecgDataLive =
    hasLive(vitals, 'HeartRate', ['Pulse', 'Heart Rate']) &&
    (hasParam(deviceStatus, 'Heart Rate', 'Pulse', 'HeartRate') || monitorReady);

  const plethDataLive =
    (hasLive(vitals, 'SpO2') || hasLive(vitals, 'Pulse', ['Heart Rate', 'HeartRate'])) &&
    (hasParam(deviceStatus, 'SpO2', 'Pulse') || monitorReady);

  const respDataLive =
    hasLive(vitals, 'Resp.Rate') &&
    (hasParam(deviceStatus, 'Resp.Rate') || monitorReady);

  const admitted = Boolean(patient?.patientName || patient?.patientMRN);

  const ecgActive = admitted && ecgDataLive;
  const plethActive = admitted && plethDataLive;
  const respActive = admitted && respDataLive;

  const footerTiles = [
    {
      label: 'Heart Rate',
      value: ecgActive && hr != null ? formatVitalValue('HeartRate', hr) : '--',
      unit: 'bpm',
      live: ecgActive,
    },
    {
      label: 'SpO2',
      value: plethActive && spo2 != null ? formatVitalValue('SpO2', spo2) : '--',
      unit: '%',
      live: plethActive && spo2 != null,
    },
    {
      label: 'Pulse',
      value: plethActive && pulse != null ? formatVitalValue('Pulse', pulse) : '--',
      unit: 'bpm',
      live: plethActive && pulse != null,
    },
    {
      label: 'Resp Rate',
      value: respActive && rr != null ? formatVitalValue('Resp.Rate', rr) : '--',
      unit: 'bpm',
      live: respActive,
    },
  ];

  return (
    <div className="waveforms-monitor">
      <div className="waveforms-stack">
        {ECG_CHANNELS.map((ch) => (
          <WaveformCanvas
            key={ch.id}
            label={ch.label}
            mode="ecg"
            ecgLead={ch.ecgLead}
            color="#22c55e"
            heartRate={hr || 72}
            active={ecgActive}
            statusValue={ecgActive && hr != null ? formatVitalValue('HeartRate', hr) : null}
            statusUnit="bpm"
          />
        ))}
        <WaveformCanvas
          label="Pleth"
          mode="pleth"
          color="#eab308"
          heartRate={pulse || hr || 72}
          active={plethActive}
          statusValue={
            plethActive && spo2 != null
              ? formatVitalValue('SpO2', spo2)
              : plethActive && pulse != null
                ? formatVitalValue('Pulse', pulse)
                : null
          }
          statusUnit={spo2 != null ? '%' : 'bpm'}
        />
        <WaveformCanvas
          label="RESP"
          mode="resp"
          color="#06b6d4"
          respiratoryRate={rr || 16}
          active={respActive}
          statusValue={respActive && rr != null ? formatVitalValue('Resp.Rate', rr) : null}
          statusUnit="bpm"
        />
      </div>

      <div className="waveforms-footer">
        <div className="waveforms-footer-bar">
          <span>Waveform parameters</span>
          <span className="waveforms-footer-hint">
            {admitted ? 'Live when device data is available' : 'Admit patient to enable waveforms'}
          </span>
        </div>
        <div className="waveforms-footer-tiles">
          {footerTiles.map((tile) => (
            <div
              key={tile.label}
              className={`waveforms-footer-tile${tile.live ? ' waveforms-footer-tile--live' : ''}`}
            >
              <div className="waveforms-footer-tile-label">{tile.label}</div>
              <div className="waveforms-footer-tile-value">
                <strong>{tile.value}</strong>
                <span>{tile.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
