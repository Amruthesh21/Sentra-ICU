# Live split deployment

This Connect-Engine-era guide is **obsolete**. Sentra ICU now splits like this:

- **Cloud:** Hub, alarm-engine, databases, RabbitMQ
- **Hospital LAN:** `deviceIngestion` only (HL7/JSON gateway)

Follow **[HOSPITAL-GATEWAY.md](./HOSPITAL-GATEWAY.md)** for the current compose
files, VPN/TLS requirements, Super Admin gateway URL, and security checklist.

`deviceIngestion` publishes straight to `alarm-engine.device.data.queue`. There
is no Connect Engine client in alarm-engine.
