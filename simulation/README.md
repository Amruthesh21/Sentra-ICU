# Simulation tool

A standalone way to see the app working with real device data, without
touching real hardware. Lives completely outside the application — nothing
in here is baked into any service's code, config, or database. Delete this
whole folder and the app is unaffected. Every run creates its test data
fresh, through the same public APIs a real user would use.

## Requirements

- The application stack must already be running (see
  `CIS-Deployment/deviceIngestion/docs/RUNBOOK.md` if it isn't).
- [Node.js](https://nodejs.org/) installed (any recent version — this uses
  only Node's built-ins, no `npm install` needed).

## Run it

**Double-click `run-simulation.bat`.**

That's it. It will:
1. Log in as the hospital admin.
2. Admit a clearly-labeled test patient ("Simulation Patient", MRN
   `SIM-001`) to the bed set in `config.json` (default `BED-01`) — skipped
   if already admitted from a previous run.
3. Connect the simulated device to that bed automatically (same mechanism
   as the real "Connect a device" panel in the Hub — nothing is force-fed
   directly into the database).
4. Replay a **real captured HL7 export** from an actual BPL VividVue M10
   monitor into the device port — not synthetic/fake numbers. The same
   fixture file device-ingestion's own automated tests use.

Then open the Hub and look — it'll print the exact URL and login to use.

Run it again any time you want to refresh the vitals (e.g. after they've
gone stale, or after restarting the containers).

## Undo it

**Double-click `reset-simulation.bat`** to discharge the simulation patient
and free the bed again.

## Configuration

Edit `config.json` — which bed to use, which real capture file to replay
(there's a second one at
`../CIS-Deployment/deviceIngestion/test/fixtures/sample-demo-mode.hl7` with
full 12-lead ECG + waveform data), URLs, credentials.

## Command line, if you prefer

```bash
node simulate.js           # admit + replay
node simulate.js --reset   # discharge
```
