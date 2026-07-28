# PULSE Integration — Real Hospital Connectivity Lab

Practice **real** FHIR / HL7 / device connections across **two networks** before you walk into a hospital.

## Architecture

```
HOSPITAL NETWORK                    PULSE CLOUD (you)
─────────────────                   ─────────────────
hospitalSimulator :9080      →      integrationEngine :9070
  FHIR server                       FHIR pull client
  HL7 pusher                        HL7 ingest + ACK
  Device pusher                     Normalize + identity match
                                    Audit + buffer
                                         ↓
                                    Hub UI :5174 /connectivity
```

## Quick start (same PC, two ports = two “networks”)

### Terminal 1 — Cloud Integration Engine
```powershell
cd "CIS-Deployment\integrationEngine"
npm install
npm start
```
→ http://127.0.0.1:9070/health

### Terminal 2 — Hospital Simulator
```powershell
cd "CIS-Deployment\hospitalSimulator"
npm install
npm start
```
→ http://127.0.0.1:9080/  (hospital control page)

### Terminal 3 — Hub UI
```powershell
cd "CIS-Deployment\icuConnectHub"
npm run dev
```
→ http://127.0.0.1:5174/connectivity

## Confidence tests (do these tomorrow morning)

### A) FHIR pull (we call hospital)
1. Open Connectivity
2. FHIR URL: `http://127.0.0.1:9080/fhir`
3. Click **Connect & sync FHIR**
4. Patients appear in “Patients received in PULSE cloud”
5. Audit shows `FHIR PULL_OK`

### B) HL7 push (hospital calls us)
1. Click **Hospital push ADT** then **Hospital push ORU vitals**
   - or open http://127.0.0.1:9080 and use buttons there
2. Watch patients + vitals update
3. Audit shows `ADT^A01` / `ORU^R01`

### C) Device adapter
1. Click **Hospital push device**
2. Meera Nair vitals land via `/ingest/device`

### D) Real failure (important for hospital talk)
1. Stop Integration Engine (cloud)
2. From hospital simulator push HL7 → you get **failure**
3. Start engine again → works  
Same story if hospital firewall blocks your cloud IP.

## True two-machine / two-network test

**Laptop A (PULSE cloud)** — your demo machine  
- Run Integration Engine + Hub  
- Note LAN IP, e.g. `192.168.1.20`  
- Allow firewall inbound TCP **9070**

**Laptop B (Hospital)** — second PC / VM / hotspot client  
- Run hospital simulator with:
```powershell
$env:PULSE_INGEST_URL="http://192.168.1.20:9070/ingest/hl7"
$env:PULSE_INGEST_TOKEN="pulse-hospital-demo-token"
npm start
```
- On Hub Connectivity, FHIR URL = `http://<LaptopB-IP>:9080/fhir`
- Push HL7 from Laptop B UI

If it fails: VPN/firewall/DNS — fix exactly like a real hospital visit.

## What to tell hospital IT

| Path | What they give you | What you give them |
|------|--------------------|--------------------|
| FHIR | Base URL + OAuth/API key | Your sync schedule / scopes (Patient, Observation, Encounter) |
| HL7 | Message types ADT/ORU… | Your ingest URL + token + ACK behaviour |
| Devices | Adapter/gateway later | HTTPS device endpoint + auth |

Demo ingest token (change for production): `pulse-hospital-demo-token`
