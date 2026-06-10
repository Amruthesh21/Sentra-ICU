import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { VITAL_PARAMS } from '../api/alarmConfig';
import { getAlarmConfig } from '../api/alarmConfig';
import { fetchLatestVitals, getVitalStatus, resolveVitalValue, formatVitalValue } from '../api/vitals';
import { fetchPatientByBed } from '../api/patients';
import { fetchCenter } from '../api/center';

const APP_VERSION = '2.1';

function PatientBedCard({ bed, vitals, thresholds, dataSource, lastUpdated, loading }) {
  const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
  const patient = bed.patient || {};

  const alarmStatuses = VITAL_PARAMS.map((param) => {
    const value = resolveVitalValue(vitals, param.paramName, param.aliases);
    const status = getVitalStatus(value, param.paramName, thresholds);
    return { ...param, value, status };
  });

  const hasCritical = alarmStatuses.some((v) => v.status === 'critical');
  const hasWarning = alarmStatuses.some((v) => v.status === 'warning');
  const overallStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';
  const overallLabel = hasCritical ? 'ALARM' : hasWarning ? 'WARNING' : 'Normal';

  const metaParts = [
    patient.patientAge ? `${patient.patientAge} yr` : null,
    patient.gender || patient.patientGender,
    patient.weight ? `${patient.weight} kg` : null,
    patient.mrn ? `MRN ${patient.mrn}` : null,
  ].filter(Boolean);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="patient-name">{patient.name || 'Patient'}</div>
          <div className="patient-meta">
            {metaParts.length ? metaParts.join(' · ') : `Bed ${bed.bedLabel}`}
          </div>
        </div>
        <span className="bed-badge">{bed.bedLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className={`alarm-badge ${overallStatus}`}>{overallLabel}</span>
        {bed.simulatorConnected && <span className="sim-badge live">LIVE</span>}
        {bed.virtualSimulatorActive && !bed.simulatorConnected && (
          <span className="sim-badge virtual">V-SIM</span>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#888', marginTop: 12 }}>Loading vitals…</p>
      ) : (
        <div className="vitals-grid" style={{ marginTop: 8 }}>
          {alarmStatuses.map((vital) => (
            <div key={`${bedId}-${vital.paramName}`} className={`vital-item ${vital.status}`}>
              <div className="vital-label">{vital.label}</div>
              <div className="vital-value">
                {vital.value != null ? formatVitalValue(vital.paramName, vital.value) : '--'}
              </div>
              <div className="vital-unit">{vital.unit}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        {lastUpdated && (
          <p className="last-updated" style={{ margin: 0 }}>
            Updated {lastUpdated.toLocaleTimeString()}
            {dataSource ? ` · ${dataSource}` : ''}
          </p>
        )}
        <Link to={`/alarms/${encodeURIComponent(bedId)}`} className="btn-link">
          Set alarms →
        </Link>
      </div>
    </div>
  );
}

export default function MyPatients() {
  const doctorId = localStorage.getItem('doctorId') || 'doctor-001';
  const [beds, setBeds] = useState([]);
  const [bedData, setBedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBedVitals = useCallback(async (bed, configs) => {
    const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
    try {
      const [vitalsResult, patientInfo] = await Promise.all([
        fetchLatestVitals(bedId),
        fetchPatientByBed(bedId).catch(() => ({})),
      ]);

      const bedConfig = configs.find((c) => c.bedId === bedId);
      const mergedPatient = {
        ...bed.patient,
        name: patientInfo.patientName || bed.patient?.name,
        mrn: patientInfo.patientMRN || bed.patient?.mrn,
        patientAge: patientInfo.patientAge,
        patientGender: patientInfo.patientGender || bed.patient?.gender,
        weight: patientInfo.patientWeight || bed.patient?.weight,
      };

      setBedData((prev) => ({
        ...prev,
        [bedId]: {
          bed: { ...bed, patient: mergedPatient },
          vitals: vitalsResult.vitals,
          thresholds: bedConfig?.alarms || [],
          dataSource: vitalsResult.source,
          lastUpdated: vitalsResult.timestamp ? new Date(vitalsResult.timestamp) : new Date(),
          loading: false,
        },
      }));
    } catch {
      setBedData((prev) => ({
        ...prev,
        [bedId]: {
          ...(prev[bedId] || { bed, vitals: {}, thresholds: [], dataSource: null, lastUpdated: null }),
          loading: false,
        },
      }));
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [center, configsRaw] = await Promise.all([
        fetchCenter(),
        getAlarmConfig(doctorId).catch(() => []),
      ]);
      const configs = Array.isArray(configsRaw) ? configsRaw : [];

      const bedList = Array.isArray(center.beds) ? center.beds : [];
      setBeds(bedList);

      const occupied = bedList.filter((b) => b.occupied);
      if (occupied.length === 0) {
        setBedData({});
        setError('No admitted patients — add beds and admit patients in ICU Connect Hub Admin.');
        setLoading(false);
        return;
      }

      setError(null);

      // Show all occupied beds immediately
      setBedData((prev) => {
        const next = { ...prev };
        for (const bed of occupied) {
          const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
          if (!next[bedId]) {
            next[bedId] = {
              bed,
              vitals: {},
              thresholds: configs.find((c) => c.bedId === bedId)?.alarms || [],
              dataSource: null,
              lastUpdated: null,
              loading: true,
            };
          }
        }
        return next;
      });

      await Promise.all(occupied.map((bed) => loadBedVitals(bed, configs)));
    } catch (err) {
      setError(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [doctorId, loadBedVitals]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const occupied = beds.filter((b) => b.occupied);
  const vacant = beds.filter((b) => !b.occupied);

  return (
    <div>
      <h1 className="page-title">My Patients</h1>
      <p className="page-subtitle">
        {occupied.length} admitted · {beds.length} beds · synced with Hub
      </p>

      {error && <div className="status-message info">{error}</div>}

      {loading && occupied.length === 0 ? (
        <p style={{ color: '#888' }}>Loading patients...</p>
      ) : (
        <>
          {occupied.map((bed) => {
            const bedId = bed.alarmBedId || `ICU-1-${bed.bedLabel}`;
            const data = bedData[bedId] || {
              bed,
              vitals: {},
              thresholds: [],
              dataSource: null,
              lastUpdated: null,
              loading: true,
            };
            return (
              <PatientBedCard
                key={bedId}
                bed={data.bed}
                vitals={data.vitals}
                thresholds={data.thresholds}
                dataSource={data.dataSource}
                lastUpdated={data.lastUpdated}
                loading={data.loading}
              />
            );
          })}

          {vacant.length > 0 && (
            <div className="card vacant-card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Vacant beds</h3>
              <div className="vacant-list">
                {vacant.map((b) => (
                  <span key={b.bedLabel} className="vacant-chip">{b.bedLabel}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="app-version">ICU Alerts v{APP_VERSION}</p>
    </div>
  );
}
