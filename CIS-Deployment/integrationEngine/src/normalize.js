/** Normalize hospital payloads into PULSE canonical patient model */

export function fromHl7(parsed) {
  return {
    mrn: parsed.mrn,
    fullName: parsed.fullName,
    unit: parsed.unit || 'ICU',
    bed: parsed.bed || '',
    source: 'HL7',
    messageType: parsed.messageType,
    vitals: parsed.vitals || {},
    status: Object.keys(parsed.vitals || {}).length ? 'live' : 'registered',
    historyEvent: {
      at: new Date().toISOString(),
      event: `HL7 ${parsed.messageType} received`,
      channel: 'HL7',
    },
  };
}

export function fromFhirPatient(resource, observations = []) {
  const mrn =
    resource?.identifier?.find((i) => i.system?.includes('mrn') || i.type?.coding?.[0]?.code === 'MR')?.value ||
    resource?.identifier?.[0]?.value ||
    resource?.id;

  const name = resource?.name?.[0];
  const fullName = [name?.given?.join(' '), name?.family].filter(Boolean).join(' ') || resource?.id;

  const vitals = {};
  for (const obs of observations) {
    const code = obs?.code?.coding?.[0]?.code || obs?.code?.text || '';
    const value = obs?.valueQuantity?.value;
    const key = String(code).toUpperCase();
    if (value == null) continue;
    if (key.includes('2708-6') || key.includes('SPO2')) vitals.spo2 = value;
    else if (key.includes('8867-4') || key.includes('HR')) vitals.hr = value;
    else if (key.includes('9279-1') || key.includes('RR')) vitals.rr = value;
    else if (key.includes('8310-5') || key.includes('TEMP')) vitals.temp = value;
    else if (key.includes('8462-4') || key.includes('DIA') || key.includes('DBP')) vitals.dbp = value;
    else if (key.includes('8480-6') || key.includes('SYS') || key.includes('SBP')) vitals.sbp = value;
  }

  const encounter = resource._encounter || {};
  return {
    mrn,
    fullName,
    unit: encounter.unit || 'ICU',
    bed: encounter.bed || '',
    source: 'FHIR',
    fhirPatientId: resource.id,
    vitals,
    status: Object.keys(vitals).length ? 'live' : 'registered',
    historyEvent: {
      at: new Date().toISOString(),
      event: 'FHIR Patient + Observation sync',
      channel: 'FHIR',
    },
  };
}

export function matchIdentity(store, patient) {
  const byMrn = patient.mrn && store.patients[patient.mrn];
  if (byMrn) {
    return {
      matched: true,
      strategy: 'MRN',
      existingId: byMrn.id,
      note: `Linked to existing patient ${byMrn.fullName}`,
    };
  }
  const fuzzy = Object.values(store.patients).find(
    (p) =>
      p.fullName &&
      patient.fullName &&
      p.fullName.toLowerCase() === patient.fullName.toLowerCase() &&
      p.bed &&
      patient.bed &&
      p.bed === patient.bed
  );
  if (fuzzy) {
    return {
      matched: true,
      strategy: 'NAME+BED',
      existingId: fuzzy.id,
      note: `Fuzzy matched ${fuzzy.fullName} on bed ${fuzzy.bed}`,
    };
  }
  return { matched: false, strategy: 'NEW', note: 'New patient identity created' };
}
