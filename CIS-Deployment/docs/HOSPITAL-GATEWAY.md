# Hospital / cloud split — production deployment

Bedside monitors live on the hospital LAN. They cannot (and must not) open
TCP to a public cloud Hub. Sentra ICU therefore runs as two deployments:

| Where | What runs | Why |
|---|---|---|
| **Cloud** | Hub, alarm-engine, notification-service, Postgres, MongoDB, RabbitMQ | Clinical UI, auth, alarms, multi-tenant data |
| **Each hospital** | `deviceIngestion` only | HL7/JSON from monitors; publishes vitals to cloud RabbitMQ; Hub maps beds and reads waveforms through alarm-engine |

Laptop all-in-one (`docker-compose.poc.yml`) still runs both halves on one
machine. Use that for development. Use this document for a real hospital.

```
Monitors --HL7/JSON--> hospital device-ingestion --AMQP over VPN--> cloud RabbitMQ
                                                              --> alarm-engine
Browser  --HTTPS------> cloud Hub --/device-ingestion--> alarm-engine
                              --HTTP over VPN--> hospital device-ingestion
```

Connect-a-device, quarantine, and live waveforms stay in the Hub. The Hub
container no longer talks to `CIS-device-ingestion` by hostname. alarm-engine
proxies `/api/device-ingestion/**` to the URL stored on that hospital
(`hub_hospitals.device_ingestion_url`), falling back to `DEVICE_INGESTION_URL`
for a local stack.

## 1. Network you must have before go-live

1. **Site-to-site VPN or private link** between hospital LAN and cloud VPC.
   Do not expose RabbitMQ AMQP or device-ingestion HTTP to the public internet.
2. From the **hospital** host, cloud RabbitMQ is reachable (AMQP/AMQPS).
3. From the **cloud** alarm-engine host, hospital `http(s)://<gateway>:9050`
   is reachable (Connect-a-device + waveforms are in-memory on the gateway).
4. From **bedside devices**, hospital `7061` (HL7) and `7062` (JSON) are
   reachable. Devices never get a cloud address.

TLS: terminate HTTPS for the Hub as usual. Prefer `amqps://` for the broker
and `https://` for the gateway URL (`DEVICE_INGESTION_REQUIRE_HTTPS=true` on
cloud once the hospital puts a certificate in front of :9050).

## 2. Cloud host

Infra first, then the app *without* the gateway:

```bash
docker network create --subnet=172.31.0.0/16 --gateway=172.31.0.1 alarampoc_docker_compose_network
cp .env.example .env   # set SUPER_ADMIN_PASSWORD, HUB_AUTH_JWT_SECRET, SMTP, etc.
docker compose -f docker-compose.infra.yml up -d
docker compose -p sentra-cloud -f docker-compose.poc.yml -f docker-compose.cloud.yml up -d --build
```

`docker-compose.cloud.yml` keeps `device-ingestion` from starting in this
project. Firewall RabbitMQ (5672 / 7003) and Postgres/Mongo to the VPN only.

On first boot, create the hospital in Super Admin and set **Device gateway
URL** to the VPN address of that site's gateway, origin only:

```
http://10.20.0.10:9050
```

No path, no credentials in the URL. Hub login tokens are forwarded as
`Authorization` headers; the gateway verifies them with the same JWT secret.

## 3. Hospital host

```bash
cp .env.hospital.example .env.hospital
```

Set:

- `HUB_AUTH_JWT_SECRET` — **identical** to cloud alarm-engine
- `HOSPITAL_RABBITMQ_URL` — cloud broker over VPN, password URL-encoded
- `DEVICE_INGESTION_HTTP_BIND` — VPN interface IP, not a public NIC

Then:

```bash
docker compose --env-file .env.hospital -f docker-compose.hospital.yml up -d --build
```

Confirm:

```bash
curl http://127.0.0.1:9050/health
# {"status":"ok","service":"device-ingestion","rabbit":true}
```

`rabbit: false` means the VPN/broker is down; the process keeps retrying.
Bed-map starts empty (named volume). Staff map devices in the Hub:
**Admin → Connect a device**. Do not commit `bed-map.json` per hospital.

Point monitors at this host: HL7 `7061`, JSON `7062`.

## 4. Laptop split-test (no second server)

Keep infra + cloud overlay, start the gateway on the same Docker network
with a Rabbit URL that reaches `CIS-rabbitmq`, then set the hospital gateway
URL to `http://CIS-device-ingestion:9050` (Docker DNS) or
`http://172.31.0.16:9050`.

A simpler path for development is the original all-in-one:

```bash
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine device-ingestion notification-service icu-connect-hub
```

No per-hospital URL needed; `DEVICE_INGESTION_URL` defaults to
`http://CIS-device-ingestion:9050`.

## 5. Security checklist

- [ ] `HUB_AUTH_JWT_SECRET` is a long random value, identical on cloud and every hospital gateway, never the repo placeholder
- [ ] `HUB_AUTH_ENFORCED=true` and `HUB_AUTH_DEV_EXPOSE_OTP=false` in production
- [ ] RabbitMQ, Postgres, Mongo, and gateway HTTP are not on the public internet
- [ ] Gateway URL is an origin only (validator rejects credentials, paths, and cloud-metadata hosts)
- [ ] Super Admin is the only role that can set the gateway URL
- [ ] Bed identity still comes from the hospital bed-map (source IP), never from the device message
- [ ] Infra passwords in `.env.example` are demo defaults — change them and rotate volumes

## 6. What still lives in-memory on the gateway

Waveforms and the unmapped-device quarantine are **not** in cloud databases.
If the VPN drops, live waveforms pause and Connect-a-device cannot load until
the proxy can reach the hospital again. Vitals already published to RabbitMQ
continue to alarm-engine.

## 7. Failure modes

| Symptom | Likely cause |
|---|---|
| Connect a device: "Device gateway is not configured" | Super Admin has not set the hospital URL and `DEVICE_INGESTION_URL` is empty |
| Connect a device: "Hospital device gateway is unreachable" | VPN down, wrong URL, or :9050 firewalled from cloud |
| Health `rabbit: false` | Hospital cannot reach cloud AMQP |
| Hub starts but no waveforms | Proxy path is up but no device mapped / device not sending |
| Two beds, one stream | Two IPs mapped to the same bed — last writer wins in alarm-engine |

Obsolete Connect-Engine-era notes used to live in
`LIVE-SPLIT-DEPLOYMENT.md`. This file replaces that guide.
