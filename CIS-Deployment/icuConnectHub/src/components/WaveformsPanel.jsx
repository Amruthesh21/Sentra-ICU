import { useEffect, useRef, useState } from 'react';
import WaveformCanvas from './WaveformCanvas';
import { formatVitalValue } from '../api/hub';
import { getWaveforms } from '../api/deviceIngestion';

function resolve(vitals, key, aliases = []) {
  if (vitals[key] != null) return vitals[key];
  for (const a of aliases) {
    if (vitals[a] != null) return vitals[a];
  }
  return null;
}

function hasLive(vitals, key, aliases = []) {
  const v = resolve(vitals, key, aliases);
  return v != null && !Number.isNaN(v);
}

// Real device-reported channel names (see the CD segment names deviceIngestion's
// core/hl7Parser.js decodes, e.g. "ECG_I"/"ECG_II"/"ECG_III"/"SPO2"/"RESP" for
// the BPL VividVue M10) mapped to this panel's fixed trace slots. Deliberately
// exact-ish rather than substring matching — "ECG_I" must not also catch
// "ECG_II"/"ECG_III".
const CHANNEL_PATTERNS = {
  ecg1: /^ECG[_-]?I$/i,
  ecg2: /^ECG[_-]?II$/i,
  ecg3: /^ECG[_-]?III$/i,
  pleth: /^(SPO2|PLETH|SPO2WAVE)$/i,
  resp: /^(RESP|RR)$/i,
};

function findChannel(waveforms, slot) {
  const pattern = CHANNEL_PATTERNS[slot];
  const key = Object.keys(waveforms || {}).find((k) => pattern.test(k));
  return key ? waveforms[key] : null;
}

const ECG_CHANNELS = [
  { id: 'ecg1', label: 'ECG 1', ecgLead: 1, slot: 'ecg1' },
  { id: 'ecg2', label: 'ECG 2', ecgLead: 2, slot: 'ecg2' },
  { id: 'ecg3', label: 'ECG 3', ecgLead: 3, slot: 'ecg3' },
];

const POLL_MS = 1000;

export default function WaveformsPanel({ vitals, patient, bedId }) {
  const hr = resolve(vitals, 'HeartRate', ['Pulse', 'Heart Rate']);
  const spo2 = resolve(vitals, 'SpO2', []);
  const rr = resolve(vitals, 'Resp.Rate', ['Resp.Rate']);
  const pulse = resolve(vitals, 'Pulse', ['Heart Rate', 'HeartRate']);

  // Gate purely on real, currently-published vitals — same source the numeric
  // tiles elsewhere on this page already trust. This used to also require
  // deviceStatus.availableParameters (fetched from alarmEngine's
  // BedDeviceService/DeviceCatalogService), a catalog hardcoded to three
  // pre-rebrand device names ("BplUltimaPrime"/"Agilia"/"BplElisa600") that
  // deviceIngestion's current 15-adapter registry never populates — so any
  // bed set up purely through the new bed-map.json flow showed "No signal"
  // here even with a real monitor sending real, live vitals. Removed rather
  // than reconciled: it was defended-in-depth against nothing hasLive()
  // doesn't already cover, just a second, disconnected source of truth.
  const ecgDataLive = hasLive(vitals, 'HeartRate', ['Pulse', 'Heart Rate']);
  const plethDataLive = hasLive(vitals, 'SpO2') || hasLive(vitals, 'Pulse', ['Heart Rate', 'HeartRate']);
  const respDataLive = hasLive(vitals, 'Resp.Rate');

  const admitted = Boolean(patient?.patientName || patient?.patientMRN);

  const ecgActive = admitted && ecgDataLive;
  const plethActive = admitted && plethDataLive;
  const respActive = admitted && respDataLive;

  // Real waveform samples — polled from deviceIngestion (via the Hub's
  // nginx proxy, see api/deviceIngestion.js's getWaveforms) roughly as
  // often as a real device actually re-batches its waveform segments, not
  // an arbitrary UI refresh choice. Only runs while this panel is mounted,
  // i.e. only while the "Live waveforms" tab is actually open. Absent or
  // empty for a device type that has no waveform output (a syringe pump,
  // most ventilator/pump-class devices) — WaveformCanvas falls back to its
  // modeled curve in that case, unchanged from before this.
  const [waveforms, setWaveforms] = useState({});
  const bedIdRef = useRef(bedId);
  bedIdRef.current = bedId;

  useEffect(() => {
    if (!admitted || !bedId) {
      setWaveforms({});
      return undefined;
    }
    let cancelled = false;
    async function poll() {
      try {
        const data = await getWaveforms(bedIdRef.current);
        if (!cancelled) setWaveforms(data || {});
      } catch {
        // Transient fetch failure — keep showing the last good window
        // rather than blank the trace on one missed poll.
      }
    }
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [admitted, bedId]);

  function realProps(slot) {
    const wf = findChannel(waveforms, slot);
    return wf?.samples?.length > 1
      ? { realSamples: wf.samples, realSampleRate: wf.sampleRate || null }
      : { realSamples: null, realSampleRate: null };
  }

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
            {...realProps(ch.slot)}
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
          {...realProps('pleth')}
        />
        <WaveformCanvas
          label="RESP"
          mode="resp"
          color="#06b6d4"
          respiratoryRate={rr || 16}
          active={respActive}
          statusValue={respActive && rr != null ? formatVitalValue('Resp.Rate', rr) : null}
          statusUnit="bpm"
          {...realProps('resp')}
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
