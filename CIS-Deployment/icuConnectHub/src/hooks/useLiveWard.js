import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acknowledgeAlarm,
  getActiveAlarms,
  getCenter,
  getLatestVitals,
  vitalsToMap,
} from '../api/hub';
import { listUnits } from '../api/units';
import { listStaff } from '../api/staff';
import { statusLabel } from '../data/pulseWard';
import { canonicalAlarmBedId } from '../api/alarmConfig';
import { BRAND_NAME, brandCenterLabel } from '../utils/brand';

/** Exact bed match only — never use String.includes (BED 1 matches BED 11). */
function alarmsForBed(alarmList, bed) {
  const target = canonicalAlarmBedId(bed.alarmBedId || bed.bedLabel);
  return (alarmList || []).filter((a) => canonicalAlarmBedId(a.bedId) === target);
}

function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function pickVital(vitals, keys) {
  for (const key of keys) {
    const v = vitals[key];
    if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  // Case-insensitive fallback across all keys
  const entries = Object.entries(vitals || {});
  for (const key of keys) {
    const want = key.toLowerCase();
    const hit = entries.find(([k]) => k.toLowerCase() === want);
    if (hit && hit[1] != null && !Number.isNaN(Number(hit[1]))) return Number(hit[1]);
  }
  return null;
}

function formatBp(vitals) {
  // Combined string e.g. "118/76"
  const combined = vitals.BP ?? vitals.NIBP ?? vitals['Blood Pressure'];
  if (typeof combined === 'string' && combined.includes('/')) {
    return combined.replace(/\s+/g, '');
  }

  const sys = pickVital(vitals, [
    'NIBP Sys', 'NIBP_Sys', 'NIBP Systolic', 'ABP Sys', 'ABP_Sys',
    'Systolic', 'SystolicBP', 'SBP', 'BP Sys', 'BP_Sys', 'Sys',
  ]);
  const dia = pickVital(vitals, [
    'NIBP Dia', 'NIBP_Dia', 'NIBP Diastolic', 'ABP Dia', 'ABP_Dia',
    'Diastolic', 'DiastolicBP', 'DBP', 'BP Dia', 'BP_Dia', 'Dia',
  ]);
  if (sys != null && dia != null) return `${Math.round(sys)}/${Math.round(dia)}`;
  return '—';
}

function deriveStatus(alarms) {
  // Status comes only from real alarm-engine events for this bed (no substring / hardcoded bleed).
  if (alarms.some((a) => String(a.severity || '').toUpperCase() === 'CRITICAL')) return 'critical';
  if (alarms.length > 0) return 'warning';
  return 'stable';
}

function alarmTitle(a) {
  const param = a.paramName || a.parameter || 'Vital';
  const val = a.currentValue != null ? a.currentValue : a.value;
  const unit = a.unit || '';
  if (val != null) return `${param} alert (${val}${unit ? ` ${unit}` : ''})`;
  return `${param} threshold breach`;
}

/**
 * Live ward board for Sentra ICU clinical pages (center beds + vitals + alarms + staff).
 */
export function useLiveWard({ pollMs = 4000 } = {}) {
  const [beds, setBeds] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [units, setUnits] = useState([]);
  const [centerName, setCenterName] = useState('ICU');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const [center, activeAlarms, unitList, staffList] = await Promise.all([
        getCenter(),
        getActiveAlarms().catch(() => []),
        listUnits().catch(() => []),
        listStaff().catch(() => []),
      ]);

      setCenterName(
        brandCenterLabel(center.centerName, center.centerLocation) || BRAND_NAME,
      );
      setUnits(Array.isArray(unitList) ? unitList : []);
      setStaff(Array.isArray(staffList) ? staffList : []);

      const rawBeds = Array.isArray(center.beds) ? center.beds : [];
      const alarmList = Array.isArray(activeAlarms) ? activeAlarms : [];

      const vitalsEntries = await Promise.all(
        rawBeds.map(async (bed) => {
          const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
          try {
            return [bed.bedLabel, vitalsToMap(await getLatestVitals(bedId))];
          } catch {
            return [bed.bedLabel, {}];
          }
        }),
      );
      const vitalsByLabel = Object.fromEntries(vitalsEntries);

      const mapped = rawBeds.map((bed) => {
        const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
        const vitals = vitalsByLabel[bed.bedLabel] || {};
        const bedAlarms = alarmsForBed(alarmList, { alarmBedId: bedId, bedLabel: bed.bedLabel });
        const occupied = Boolean(bed.occupied && bed.patient);
        const status = occupied ? deriveStatus(bedAlarms) : 'available';
        const patient = bed.patient || {};
        const unitMeta = unitList.find((u) => u.unitId === bed.unitId)
          || unitList.find((u) => (u.beds || []).some?.((b) => b.bedLabel === bed.bedLabel));

        return {
          id: bed.bedLabel,
          bedLabel: bed.bedLabel,
          alarmBedId: bedId,
          unit: unitMeta?.code || unitMeta?.name || bed.unitCode || center.centerName || 'ICU',
          unitId: bed.unitId || unitMeta?.unitId || null,
          free: !occupied,
          occupied,
          patient: occupied ? (patient.name || 'Patient') : null,
          age: calcAge(patient.dateOfBirth),
          sex: patient.gender || patient.sex || null,
          diagnosis: patient.diagnosis || patient.primaryDiagnosis || '—',
          attendingPhysician: patient.attendingPhysician || null,
          primaryNurse: patient.primaryNurse || null,
          mrn: patient.mrn || null,
          status,
          hr: vitals.HeartRate != null ? Math.round(vitals.HeartRate) : null,
          spo2: vitals.SpO2 != null ? Math.round(vitals.SpO2) : null,
          bp: formatBp(vitals),
          rr: vitals['Resp.Rate'] != null ? Math.round(vitals['Resp.Rate']) : (vitals.RR != null ? Math.round(vitals.RR) : null),
          alarmCount: bedAlarms.length,
          deviceIp: bed.deviceIp || null,
          simulatorConnected: Boolean(bed.simulatorConnected),
          liveVitalsCapable: Boolean(bed.liveVitalsCapable),
          virtualSimulatorActive: Boolean(bed.virtualSimulatorActive),
          simulationMode: bed.simulationMode || (bed.liveVitalsCapable ? 'live' : bed.virtualSimulatorActive ? 'virtual' : 'offline'),
          hasVitals: Object.keys(vitals).length > 0,
        };
      });

      setBeds(mapped);
      setAlerts(alarmList.map((a, i) => {
        const canonical = canonicalAlarmBedId(a.bedId);
        const match = mapped.find((b) => canonicalAlarmBedId(b.alarmBedId || b.bedLabel) === canonical);
        const severity = String(a.severity || '').toUpperCase() === 'CRITICAL' ? 'critical' : 'warning';
        return {
          id: `${a.bedId}|${a.paramName}|${a.threshold}|${i}`,
          severity,
          title: alarmTitle(a),
          patient: match?.patient || a.patientName || 'Patient',
          bed: match?.bedLabel || canonical.replace(/^ICU-1-/, '') || a.bedId,
          bedId: a.bedId,
          paramName: a.paramName,
          threshold: a.threshold,
          thresholdValue: a.thresholdValue,
          currentValue: a.currentValue,
          severityLabel: String(a.severity || severity).toUpperCase(),
          raw: a,
        };
      }));
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load ward data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const occupied = useMemo(() => beds.filter((b) => b.occupied), [beds]);

  const stats = useMemo(() => {
    const critical = occupied.filter((b) => b.status === 'critical').length;
    const occupancy = beds.length ? Math.round((occupied.length / beds.length) * 100) : 0;
    return {
      patients: occupied.length,
      critical,
      occupancy,
      activeAlerts: alerts.length,
      bedCount: beds.length,
    };
  }, [beds, occupied, alerts]);

  async function ackAlert(alert) {
    await acknowledgeAlarm({
      bedId: alert.bedId || alert.raw?.bedId,
      paramName: alert.paramName || alert.raw?.paramName,
      threshold: alert.threshold ?? alert.raw?.threshold,
      currentValue: alert.currentValue ?? alert.raw?.currentValue,
    });
    window.dispatchEvent(new Event('pulse-alerts-changed'));
    await load();
  }

  return {
    beds,
    occupied,
    alerts,
    staff,
    units,
    stats,
    centerName,
    loading,
    error,
    updatedAt,
    refresh: load,
    ackAlert,
    statusLabel,
  };
}
