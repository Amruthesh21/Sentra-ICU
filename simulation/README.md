# Simulation tools

Standalone ways to see the app working with real device data, without
touching real hardware. Both live completely outside the application —
nothing in here is baked into any service's code, config, or database.
Delete this whole folder and the app is unaffected. Both send real captured
device data (the same fixtures deviceIngestion's own automated tests use),
never synthetic/fake numbers.

Two tools, two different jobs:

- **`simulate.js`** — one-shot local demo. Admits a test patient, maps the
  device, replays one BPL VividVue M10 export, done. Good for "just show me
  it working" on the same machine.
- **`device-emulator.js`** — an actual persistent network device, like
  the original simulator jar. Run it from any machine (including a different
  one from wherever Sentra ICU itself runs) pointed at the server's IP, and
  it behaves like a real bedside monitor sitting on the network: connect,
  stream continuously, stay connected. You map it to a bed yourself through
  the real Hub UI, same as onboarding an actual device. Supports all 15
  device models deviceIngestion knows about, not just the M10.

Both need the application stack already running (see
`CIS-Deployment/deviceIngestion/docs/RUNBOOK.md` if it isn't) and
[Node.js](https://nodejs.org/) installed (any recent version — both use only
Node's built-ins, no `npm install` needed).

## simulate.js — one-shot local demo

### Run it

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

### Undo it

**Double-click `reset-simulation.bat`** to discharge the simulation patient
and free the bed again.

### Configuration

Edit `config.json` — which bed to use, which real capture file to replay
(there's a second one at
`../CIS-Deployment/deviceIngestion/test/fixtures/sample-demo-mode.hl7` with
full 12-lead ECG + waveform data), URLs, credentials.

### Command line, if you prefer

```bash
node simulate.js           # admit + replay
node simulate.js --reset   # discharge
```

## device-emulator.js — a persistent network device

### Run it

**Double-click `run-device-emulator.bat`** and answer its two prompts (the
Sentra ICU server's IP, and which device to emulate — blank for the
default, a full-waveform patient monitor). Or from the command line:

```bash
node device-emulator.js --host 192.168.1.50                      # default device (BPL VividVue M10, full waveforms)
node device-emulator.js --host 192.168.1.50 --device BplAcuraS1  # a device with no waveform output, on purpose
node device-emulator.js --list                                   # every device it can emulate
node device-emulator.js --help                                   # all options
```

It opens a TCP connection to that IP's deviceIngestion port and streams a
real captured export on a loop, reconnecting on its own if the connection
drops — it keeps running (Ctrl+C to stop) rather than sending once and
exiting, so it behaves like an actual monitor left switched on, not a
one-shot script.

After a couple of seconds it tries to tell you exactly which IP the server
saw the connection from (best-effort — needs the Hub's login API reachable
too; if that fails, check the Hub UI's own "Connect a device" panel
instead). Take that IP into the Hub: **Admin → "Connect a device"** → map it
to a bed, same as onboarding a real monitor — this tool never does that
mapping for you, on purpose, since the whole point is exercising the real
onboarding flow rather than scripting around it.

### Which device to pick

Run `node device-emulator.js --list` for the full menu. A few worth calling
out:

- **`BplVividVueM10`** (default) — patient monitor, full 12-lead ECG + pleth
  + resp waveforms. The one to use for seeing real waveforms render in the
  Hub's "Live waveforms" tab.
- **`BplAcuraS1`**, **`SchillerNeumovent`**, **`EvitaV600`**,
  **`DraegerSavina300`**, **`BplPenlon320`** — pump/ventilator/anesthesia
  devices with real vitals but genuinely no waveform output. Useful for
  confirming the Hub correctly shows "No signal" on those traces rather
  than faking one.
- **`IntelliVue`**, **`MX550`** — JSON-protocol patient monitors (port 7062
  instead of 7061), for exercising that side of deviceIngestion.

### Testing more than one device type from the same machine

deviceIngestion maps a connection to a device model by IP, from bed-map.json
— never by anything the device itself claims to be (same principle as
trusting the IP for which bed, not the message). So if you first map this
machine's IP while emulating `BplVividVueM10`, then switch to emulating
`MX550` from the same machine without updating that mapping's device type,
deviceIngestion still parses the new stream as an M10 — a real device
swapped onto an existing network jack without reconfiguring the app would
behave the same way. Re-map the IP with the correct device type from the
Hub's "Connect a device" panel each time you switch which device this tool
is emulating.
