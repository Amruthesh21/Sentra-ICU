# Sentra ICU

## Operator & Training Manual

**Product:** Sentra ICU Connect Hub  
**Audience:** Platform operators (Super Admin), hospital IT / biomedical engineering, hospital administrators, intensivists, physicians, ICU nurses, and trainers  
**Companion technical docs:** `HOSPITAL-GATEWAY.md` (production split), `deviceIngestion/docs/RUNBOOK.md` (local stack)

---

### How to use this book

This is the **end-user operating manual**. Train people from it in this order:

1. **Part A** — What the product is, and the three kinds of user.  
2. **Part B** — Super Admin: how you run many hospitals from one dashboard.  
3. **Part C** — How you install Sentra ICU in a hospital (cloud + on-site gateway).  
4. **Part D** — Hospital Admin: units, beds, devices, logins, roster.  
5. **Part E** — Doctors and nurses: every clinical screen.  
6. **Part F** — Do / don’t, who to call, FAQs, training checklists.

Do **not** skip Part A. Most mistakes in the field come from mixing up the three roles, or mixing up a **login account** with a **roster name**.

Print or export this file to PDF for classroom training. Each numbered procedure is a hands-on exercise.

---

# Table of contents

1. [What Sentra ICU is](#1-what-sentra-icu-is)  
2. [The three users](#2-the-three-users)  
3. [How information moves](#3-how-information-moves)  
4. [Signing in](#4-signing-in)  
5. [Super Admin — operating the platform](#5-super-admin--operating-the-platform)  
6. [Installing Sentra ICU in a hospital](#6-installing-sentra-icu-in-a-hospital)  
7. [Hospital Admin — running one hospital](#7-hospital-admin--running-one-hospital)  
8. [Doctors and nurses — using the ward](#8-doctors-and-nurses--using-the-ward)  
9. [The bedside chart (bed detail)](#9-the-bedside-chart-bed-detail)  
10. [Shift playbooks](#10-shift-playbooks)  
11. [Do and don’t](#11-do-and-dont)  
12. [When something is not working](#12-when-something-is-not-working)  
13. [Frequently asked questions](#13-frequently-asked-questions)  
14. [Training checklists](#14-training-checklists)  
15. [Glossary](#15-glossary)  
16. [Quick reference cards](#16-quick-reference-cards)  
17. [Two-day training agenda](#17-two-day-training-agenda)  
18. [Worked example](#18-worked-example--one-patient-through-the-system)  
19. [Permission catalog](#19-permission-catalog-hospital-admin--roles)  
20. [Device models and ports](#20-device-models-and-ports)  
21. [Go-live day](#21-go-live-day-hospital--hour-by-hour)  
22. [Competency questions](#22-competency-questions-with-answers)  
23. [Policies the hospital should write](#23-policies-the-hospital-should-write-sentra-does-not-replace-these)  
24. [Super Admin — many hospitals](#24-super-admin--running-many-hospitals)  
25. [Note templates](#25-clinical-documentation--what-each-note-template-is-for)  
26. [Alarm threshold parameters](#26-alarm-thresholds--parameters-you-can-set)  
27. [Screen-by-screen index](#27-screen-by-screen-index-for-where-do-i-click)

---

# 1. What Sentra ICU is

Sentra ICU is a **multi-hospital ICU operations and bedside monitoring system**.

It is **not** a generic HIS / EMR replacement. It is the layer that:

- lets **you (the vendor / platform operator)** run many hospitals from one Super Admin dashboard;
- lets **one hospital’s administrator** create that hospital’s ICUs, beds, staff logins, and device mappings;
- lets **doctors and nurses** see live vitals and waveforms, admit and discharge, document, score, and report — **only for the hospital they belong to**.

A doctor at Hospital A never sees Hospital B’s patients. A hospital admin never sees another hospital. Super Admin sees hospitals as **tenants**, not as a clinical ward.

### 1.1 What you see in the browser

Everyone uses the same Hub URL (for example `https://hub.yourcompany.com` in production, or `http://localhost:7040` on a training laptop).

After login, the **left sidebar** is the same Sentra chrome for all three roles. Only the **menu items** change.

| Role | You land on | Left navigation |
|------|-------------|-----------------|
| Super Admin | Hospitals | Hospitals, Centers & Admins · Tools: Platform Analytics, Audit Logs |
| Hospital Admin | Administration | Universal, Administration, Users & Roles, Alarms · Tools: Analytics, Audit Log |
| Doctor / nurse | Overview | Overview, Patients, Beds, Alerts · Tools: Admissions, Analytics, Scoring, Reports, Universal |

Top right: today’s date and your **account chip** (initials or photo). Hover it for name, role, email. Bottom left: **Sign out**.

### 1.2 What Sentra ICU is not

- It is **not** the bedside monitor. Philips, Mindray, BPL, Draeger and others still sit on the bed. Sentra **reads** them.
- It is **not** a public website for patients or families.
- Super Admin is **not** a doctor’s workstation. You will not open live waveforms from Super Admin.
- Hospital Admin is **not** the person who admits a patient. They **configure** the ward so doctors can.
- A name on the **admission roster** is **not** a login. See §2.3.

---

# 2. The three users

Think of Sentra ICU as three locked rooms that share a front door.

```
                         ┌─────────────────────────┐
                         │   Sentra ICU Hub URL    │
                         │   Choose your area      │
                         └───────────┬─────────────┘
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   Super Admin                 Hospital Admin              Doctors & nurses
   (you / vendor)              (one hospital)              (that hospital’s ward)
   Many hospitals              Units, beds, devices,       Live vitals, admit,
   Gateways, tenants           logins, roster              waveforms, chart
```

### 2.1 Super Admin — the platform operator

This is **you**: the person who deployed Sentra ICU on your servers and sells it to hospitals.

You:

- create each hospital tenant;
- create the first hospital admin and give them a temporary password;
- set the **device gateway URL** (where that hospital’s monitors talk);
- activate / deactivate hospitals and extra hospital admins;
- watch platform analytics and the audit trail.

You do **not**:

- create ICU beds for clinical use (hospital admin does);
- map a monitor to a bed (hospital admin does);
- admit patients or open waveforms.

### 2.2 Hospital Admin — one hospital’s operator

This person runs **one hospital only**. They are typically hospital IT, biomedical engineering, or a nominated ICU administrator.

They:

- create ICU **units** and **beds**;
- **Connect a device** (map monitor IP → bed + model);
- create **login accounts** for doctors and nurses, with roles and photos;
- maintain the **admission roster** (who can be picked as attending doctor / primary nurse);
- watch a hospital-wide Universal dashboard, Alarm Center, analytics, and hospital audit log.

They do **not**:

- see another hospital;
- sit the ward as a clinician (no Overview bed grid, no admit/discharge, no bedside chart).

### 2.3 Doctors and nurses — clinical staff

Intensivists, physicians, consultants, ICU nurses, charge nurses, respiratory therapists — anyone given a **clinical login** by the hospital admin.

They:

- see only **their hospital’s** configured ward;
- admit, readmit, discharge;
- open a bed for vitals, waveforms, trends, labs, notes, orders, fluids, alarms;
- acknowledge alerts, set alarm thresholds, score (NEWS2 / SOFA / APACHE II / RASS / CAM-ICU), generate reports.

They do **not**:

- create units or beds;
- map devices;
- create other users’ logins.

### 2.4 Two directories that look similar (train this until it sticks)

| | **Users & Roles** (Hospital Admin → Users) | **Admission roster** (Hospital Admin → Administration, bottom of page) |
|---|---|---|
| What it is | **Login accounts** | **Clinical names** used on admission |
| Can they sign in? | **Yes** | **No** |
| Who creates it? | Hospital Admin | Hospital Admin |
| Used for | Username, password, MFA, role permissions, profile photo | “Assign doctor” / “Assign nurse” dropdowns on Admissions |
| Example | `doctor@hospital.org` with role Intensivist | Roster row “Dr Mehta, Intensivist, ON DUTY” |

**A doctor needs both** if they will log in **and** be assigned on an admission. Creating only the login does not put them in the doctor dropdown. Creating only the roster row does not let them sign in.

---

# 3. How information moves

Train Super Admin and hospital IT on this picture. Clinical staff only need the last sentence: *the monitor must be mapped to the bed, or the bed stays empty.*

```
Bedside monitor
    │  HL7 port 7061  or  JSON port 7062
    ▼
Hospital device-ingestion (on the hospital LAN)
    │  vitals → RabbitMQ (VPN)     waveforms stay in memory on the gateway
    ▼
Cloud Alarm Engine
    │  stores vitals, evaluates alarms, serves the API
    ▼
Cloud Hub (browser)
    Overview / bed chart / Connect a device
```

**Rules that never change:**

1. A monitor is **never trusted** to say which bed it is in. Identity comes from **source IP → bed map**, which Hospital Admin sets under **Connect a device**.
2. Unmapped traffic is **quarantined** (“Devices waiting to be connected”). It is not guessed.
3. Two IPs mapped to the **same** bed ID: last writer wins. Never do this.
4. Waveforms live **in memory on the hospital gateway**. If the VPN drops, live traces pause. Vitals already queued may still arrive.
5. Empty vitals means **no mapped device sending**. Sentra does **not** invent numbers.

---

# 4. Signing in

### 4.1 Open the Hub

Production: the HTTPS URL your Super Admin issued.  
Training laptop: `http://localhost:7040`.

The public landing page is marketing. Click **Launch** (or go to `/login`).

### 4.2 Choose your area **first**

You will see three cards:

1. **Super Admin** — “You operate the platform.”  
2. **Hospital Admin** — “You run one hospital.”  
3. **Doctors & nurses** — “You work the ward.”

Credentials **only work in the area they belong to**. A doctor account cannot enter Super Admin. A Super Admin password cannot enter the clinical ward. If the password is right but the area is wrong, sign-in fails.

If you picked the wrong card, click **← Choose a different area**.

### 4.3 Email and password

Use the **work email** the platform / hospital admin created — not a shared “icu” account.

First login for a new hospital admin or a new clinician often uses a **temporary password**. After that, Sentra asks you to **complete your profile** (username, full name, specialty, new password of at least 8 characters). That temp password will not work again.

### 4.4 MFA (the 6-digit code)

After password, you confirm access with a 6-digit code.

| Environment | What happens |
|-------------|--------------|
| **Production** (SMTP on, `HUB_AUTH_DEV_EXPOSE_OTP=false`) | Code is **emailed**. It is not shown on screen. |
| **Training laptop** (`HUB_AUTH_DEV_EXPOSE_OTP=true`, SMTP often off) | Code is shown on the page. Click **Use this code**. The training code is **`123456`**. |

**Never** leave on-screen OTP enabled on a real hospital or public server.

Paste is supported. After six digits the form submits. **Resend code** has a 30-second cooldown.

### 4.5 Where you land

| You signed in as | Home screen |
|------------------|-------------|
| Super Admin | **Hospitals** |
| Hospital Admin | **Administration** |
| Doctor / nurse | **Overview** |

### 4.6 Sign out

Sidebar bottom: **Sign out**. Always sign out on a shared ward PC.

### 4.7 Account chip and photo

Hover the initials (or photo) at top right.

- Super Admin / Hospital Admin / Clinician label, email, username, specialty.  
- **Profile photos are uploaded by Hospital Admin** on **Users & Roles**, not by the clinician themselves. JPEG / PNG / WebP, 1 MB max.

---

# 5. Super Admin — operating the platform

This chapter is for **you**, the vendor. Hospital admins and doctors skip to Parts D and E after they understand §2.

## 5.1 Your job in one paragraph

You keep the cloud Hub running, onboard each hospital as a **tenant**, give that hospital **one admin**, point Sentra at that hospital’s **device gateway**, and you stay out of clinical charting.

## 5.2 First login after a new cloud install

1. Open the Hub URL.  
2. Choose **Super Admin**.  
3. Sign in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from the server `.env`.  
4. Complete MFA.  
5. You should see **Hospitals**. If the list is empty, that is correct — you have not onboarded anyone yet.

If login fails: the password was blank at first boot (no Super Admin was seeded). Set `SUPER_ADMIN_PASSWORD` and re-run the bootstrap / restart alarm-engine. See §6.

## 5.3 Hospitals — the home screen

**Navigate:** left nav **Hospitals**.

**KPI cards (top):**

- Hospitals (and how many are active)  
- Centers  
- Hospital admins  
- Clinical staff  
- Role chips: Intensivists, RMOs, CCNs, Respiratory (counts of **roster / clinical** staff types across the platform)

**Hospital registry table:** serial number, hospital name + code, primary admin, center count, staff count, status, **Full info**.

**Filters:** Any / Active / Inactive; search by hospital, code, admin name or email.

### 5.3.1 Add a hospital (the onboarding ritual)

1. Click **+ Add hospital**.  
2. Fill:

   | Field | Required | What to type |
   |-------|----------|----------------|
   | Hospital name | Yes | Legal / common name, e.g. `Apollo Indiranagar` |
   | Admin email | Yes | Real email of the person who will run that hospital |
   | Admin display name | No | e.g. `Priya Shah` |
   | Temp password | Yes (or Generate) | Share this **once**, out of band (phone / sealed envelope). They will change it. |
   | Device gateway URL | No at this step | Origin only, e.g. `http://10.20.0.10:9050`. Leave **blank** on a laptop all-in-one install. |

3. Submit. Sentra will:

   - create the hospital tenant (status **Active**);  
   - seed default roles for that hospital;  
   - create the hospital admin login;  
   - **provision a private empty ICU center** for that hospital (it does **not** share another hospital’s beds).

4. Copy the temp password from the credentials modal **before you close it**. If you lose it, use **Reset temp password** on the hospital profile or Centers & Admins.

**Do:** use a real email. MFA in production is emailed there.  
**Don’t:** reuse one hospital admin across two hospitals.  
**Don’t:** type credentials, paths, or query strings in the gateway URL. Origin only: scheme + host + port.

### 5.3.2 Open a hospital profile

Click the hospital name or **Full info**.

Title becomes **Hospital profile**.

You will see:

- name, code, Active/Inactive;  
- counts: centers, staff, admins;  
- **Manage centers & admins** → Centers & Admins filtered to this hospital;  
- **Full audit log** → platform audit filtered to this hospital;  
- **Activate / Deactivate** and **Deactivate hospital** (confirm);  
- **Hospital device gateway** — edit URL, **Save**;  
- staff-by-role chips;  
- hospital admins (with **Reset temp password**);  
- linked centers;  
- a short embedded audit list.

**When to set the gateway URL**

| Situation | Gateway URL |
|-----------|-------------|
| Laptop / demo, everything in one Docker compose | Leave blank. Uses `DEVICE_INGESTION_URL` (usually `http://CIS-device-ingestion:9050`). |
| Real hospital, gateway on their LAN | VPN address of that host, origin only: `http://10.20.0.10:9050` or `https://gw.hospital.example`. |
| Gateway not installed yet | Create the hospital first; set the URL the day biomedical brings the gateway up. Until then, Connect a device will fail. |

Status text: **configured** vs **using the deployment default**.

### 5.3.3 Deactivate a hospital

Use this when a contract ends or a site must be frozen.

- Inactive hospital admins **cannot sign in**.  
- Confirm the dialog. This is an operational freeze, not “delete the building from history.” Audit remains.

## 5.4 Centers & Admins

**Navigate:** **Centers & Admins**.

A **center** is one ICU site record inside a hospital (code, name, location). Creating a hospital already creates one empty center. You rarely need a second unless the hospital truly has two independently mapped ICUs.

**Filters:** hospital dropdown (All hospitals or one), status, search.

**Table — centers:** hospital, center, location, hospital admin, hospital status, center status, **Active / Delete**.

**Table — hospital admins:** hospital, name, email, status, **Reset temp password**, Active, Delete.

**Banner you must teach:** *Inactive admins cannot sign in or create hospital users.*

### 5.4.1 Add a second hospital admin

1. Filter to the hospital (or open from hospital profile).  
2. **+ Add admin**.  
3. Email, display name, temp password.  
4. Hand the temp password to that person. They complete profile + MFA on **Hospital Admin** portal.

Use this for backup coverage (IT + biomedical), not for doctors.

### 5.4.2 Link a new center (uncommon)

Detail mode → **Link new center**: Center ID (stored uppercase), optional name, location.  
Only do this with a written reason. Most hospitals need **one** center and many **units** (Hospital Admin creates units).

### 5.4.3 Reset a hospital admin’s password

**Reset temp password** issues a new temporary password. They must complete setup again. Tell them out of band. Never paste it into a ticket that others can read.

## 5.5 Platform Analytics

**Navigate:** Tools → **Platform Analytics**.

This is **not** bedside clinical analytics. It is tenant health:

- Overview — hospitals active, centers linked, clinical staff provisioned, admin actions, audit volume chart;  
- Tenant adoption;  
- Governance & audit.

Use it in weekly ops reviews: who signed in, which hospitals are idle, whether onboarding is stuck.

## 5.6 Audit Logs (platform)

**Navigate:** Tools → **Audit Logs**.

Columns: When, Category, Action, Actor, Hospital, Detail, IP.

Categories:

- **AUTH** — sign-in, MFA, setup;  
- **PLATFORM** — Super Admin actions (create hospital, gateway URL, deactivate);  
- **HOSPITAL** — hospital-admin actions (users, roles).

Filter by hospital and category. This is your evidence trail for security reviews.

## 5.7 What Super Admin never does

- Do not ask for a doctor login to “just check a bed.” You will not get the ward.  
- Do not map devices. You will not see Connect a device.  
- Do not share one ICU center across hospitals. Each hospital gets its own empty center on create.  
- Do not leave `HUB_AUTH_DEV_EXPOSE_OTP=true` on a customer cloud.  
- Do not put RabbitMQ, Postgres, Mongo, or gateway HTTP on the public internet.

## 5.8 Super Admin weekly checklist

- [ ] All contracted hospitals **Active**.  
- [ ] Each live hospital has a **reachable gateway URL** (or intentional blank for all-in-one).  
- [ ] At least one **Active** hospital admin per site.  
- [ ] Scan AUTH failures on Audit Logs.  
- [ ] Confirm SMTP is sending MFA (production).  
- [ ] No leftover training accounts on a live tenant.

---

# 6. Installing Sentra ICU in a hospital

This chapter is for Super Admin **plus** hospital IT / biomedical. Doctors do not install anything.

There are two legitimate topologies.

## 6.1 Topology A — training laptop (all-in-one)

Everything runs on one machine: Hub, alarm-engine, device-ingestion, Postgres, Mongo, RabbitMQ.

```bash
docker compose -p alarampoc -f docker-compose.poc.yml up -d --build alarm-engine device-ingestion notification-service icu-connect-hub
```

- Hub: `http://localhost:7040`  
- API: `http://localhost:7020`  
- HL7 in: **7061**  
- JSON in: **7062**  
- Gateway URL on the hospital record: **leave blank**

Use this for demos and classroom. It is **not** how a real hospital is wired.

## 6.2 Topology B — production split (the real product)

Bedside monitors **must not** open TCP to the public cloud.

| Where | What runs |
|-------|-----------|
| **Your cloud** | Hub, alarm-engine, notification-service, Postgres, MongoDB, RabbitMQ |
| **Each hospital LAN** | **device-ingestion only** |

**You must have, before go-live:**

1. Site-to-site **VPN** (or private link) between hospital LAN and your VPC.  
2. From the hospital host: cloud RabbitMQ reachable (AMQP / AMQPS).  
3. From cloud alarm-engine: hospital gateway `http(s)://<host>:9050` reachable.  
4. From bedside devices: hospital **7061** (HL7) and **7062** (JSON) reachable. Devices never receive a cloud address.

### 6.2.1 Cloud host (your server)

```bash
docker network create --subnet=172.31.0.0/16 --gateway=172.31.0.1 alarampoc_docker_compose_network
cp .env.example .env
# set SUPER_ADMIN_PASSWORD, HUB_AUTH_JWT_SECRET, SMTP, HUB_AUTH_DEV_EXPOSE_OTP=false, HUB_AUTH_ENFORCED=true
docker compose -f docker-compose.infra.yml up -d
docker compose -p sentra-cloud -f docker-compose.poc.yml -f docker-compose.cloud.yml up -d --build
```

The cloud overlay **does not** start device-ingestion. Firewall RabbitMQ (host **7003**), Postgres, Mongo to the VPN only.

Generate a real JWT secret:

```bash
openssl rand -base64 48
```

Put the **same** value in cloud `.env` as `HUB_AUTH_JWT_SECRET` **and** in every hospital `.env.hospital`. If they differ, Connect a device and waveforms fail authentication.

### 6.2.2 Create the hospital in Super Admin

Follow §5.3.1. After biomedical confirms the gateway IP, set **Device gateway URL** to that origin, for example:

```
http://10.20.0.10:9050
```

No path. No username. No password in the URL. Hub login tokens are forwarded as `Authorization`; the gateway verifies them with the shared JWT secret.

### 6.2.3 Hospital host (their server on the ICU network)

On the machine that can see the monitors:

```bash
cp .env.hospital.example .env.hospital
```

Set at least:

| Variable | Meaning |
|----------|---------|
| `HUB_AUTH_JWT_SECRET` | **Identical** to cloud |
| `HOSPITAL_RABBITMQ_URL` | Cloud broker over VPN, e.g. `amqps://user:pass%40word@vpn-host:5671/ICUcharting` (`@` in passwords → `%40`) |
| `DEVICE_INGESTION_HTTP_BIND` | VPN interface IP in production — **not** a public NIC |
| `DEVICE_INGESTION_HL7_PORT` | Default `7061` |
| `DEVICE_INGESTION_JSON_PORT` | Default `7062` |
| `DEVICE_INGESTION_HTTP_PORT` | Default `9050` |

Then:

```bash
docker compose --env-file .env.hospital -f docker-compose.hospital.yml up -d --build
```

Health check on the hospital box:

```bash
curl http://127.0.0.1:9050/health
# {"status":"ok","service":"device-ingestion","rabbit":true}
```

`rabbit: false` → VPN or broker URL is wrong. The process keeps retrying. Fix network before blaming the Hub.

**Bed-map starts empty.** Do not copy another hospital’s `bed-map.json`. Mapping is done in the Hub: Hospital Admin → **Administration → Connect a device**.

### 6.2.4 Point the monitors

Biomedical / vendor engineer:

- HL7/MLLP devices (many BPL and similar): destination **hospital gateway IP, port 7061**.  
- JSON devices (some Philips / Draeger paths): port **7062**.  
- Each monitor should have a **stable IP** (DHCP reservation). The map is by IP.

### 6.2.5 Ports cheat sheet

| Service | Typical host port | Who talks to it |
|---------|-------------------|-----------------|
| Hub UI | 7040 (or HTTPS 443) | Browsers |
| Alarm Engine API | 7020 | Hub proxy, integrations |
| device-ingestion HL7 | 7061 | Monitors |
| device-ingestion JSON | 7062 | Monitors |
| device-ingestion HTTP | 9050 | Cloud alarm-engine over VPN only |
| Postgres | 7001 | Cloud only |
| MongoDB | 7000 | Cloud only |
| RabbitMQ AMQP | 7003 | Hospital gateway over VPN |
| RabbitMQ management | 7004 | Operators, not public |

### 6.2.6 Production security checklist (do not skip)

- [ ] `HUB_AUTH_JWT_SECRET` is long, random, identical everywhere, **not** the repo placeholder  
- [ ] `HUB_AUTH_ENFORCED=true`  
- [ ] `HUB_AUTH_DEV_EXPOSE_OTP=false`  
- [ ] SMTP enabled with real mailbox for MFA  
- [ ] RabbitMQ, databases, gateway HTTP **not** on the public internet  
- [ ] Infra demo passwords from `.env.example` **changed**, volumes rotated if the stack already booted once  
- [ ] Gateway URL is origin-only  
- [ ] Only Super Admin can change gateway URL  

## 6.3 After install — who does what

| Step | Owner |
|------|--------|
| Cloud up, Super Admin can log in | Super Admin / your DevOps |
| Hospital tenant created, admin temp password delivered | Super Admin |
| Gateway container healthy, `rabbit: true` | Hospital IT |
| Monitors sending to 7061/7062 | Biomedical |
| Units and beds created | Hospital Admin |
| IP mapped to bed + model | Hospital Admin |
| Doctor/nurse logins + roster | Hospital Admin |
| First admission + confirm waveforms | Clinical + Hospital Admin together |

## 6.4 What “installed” means (acceptance test)

A hospital is live when **all** of these pass:

1. Hospital Admin signs in on **Hospital Admin** portal.  
2. Administration shows at least one unit and one bed.  
3. Connect a device shows the monitor **Connected** (or it appears under waiting-to-connect and is then mapped).  
4. A clinician admits a test patient (or uses a vacant bed after mapping).  
5. Overview or bed **Live waveforms** shows a trace **or** vitals tiles populate. Empty tiles with a mapped, sending device = call biomedical + check model.  
6. Super Admin audit log shows the hospital admin sign-in.

---

# 7. Hospital Admin — running one hospital

This chapter is the curriculum for the hospital’s nominated administrator.

## 7.1 Your job in one paragraph

You build the **floor**: units, beds, device map, people who can log in, and people who can be assigned on an admission. Doctors cannot do this. You do not chart patients.

## 7.2 First hour after you receive credentials

1. Open the Hub URL.  
2. Choose **Hospital Admin** (not Doctors & nurses).  
3. Email + temp password.  
4. **Complete profile** if asked (username, name, specialty, new password ≥ 8 characters).  
5. MFA.  
6. You land on **Administration**.

If you landed on Overview, you chose the wrong portal — you used a clinical account.

## 7.3 The Hospital Admin menu

| Menu | Purpose |
|------|---------|
| **Universal** | Hospital-wide occupancy, risk, alarm counts. Read-only. No bedside. |
| **Administration** | Units, beds, Connect a device, admission roster. **Your main workplace.** |
| **Users & Roles** | Login accounts and permission roles. Photos. |
| **Alarms** | Hospital Alarm Center (acknowledge). No waveforms. |
| **Analytics** (Tools) | ICU command-center KPIs for the hospital. |
| **Audit Log** (Tools) | Sign-ins and admin changes for **this hospital only**. |

## 7.4 Administration — create an ICU unit

**Navigate:** **Administration**.

**Create ICU Unit** card:

1. **Block / Wing** (optional) — e.g. `Block A`.  
2. **Unit code** (required) — short unique code, e.g. `ICU1`, `MICU`, `SICU`.  
3. **Unit name** (required) — e.g. `Medical ICU 1`.  
4. **Create unit**.

The unit appears under **Units & beds**. You need at least one unit before beds.

**Don’t** recycle codes from another hospital’s training notes (`SENTRA_ICU` demo codes). Use **this** hospital’s real names.

## 7.5 Administration — add beds

**Add bed to unit** card:

1. Select the ICU unit.  
2. **Bed name** — e.g. `BED-01`. The Hub stores this in uppercase.  
3. **Add bed**.

Repeat for every physical bay.

**Naming rules (teach biomedical the same names):**

- Pick one scheme and keep it: `BED-01`, `BED-02` **or** `ICU1-01`.  
- Alarm thresholds and vitals keys must **match exactly**. `BED-01` and `BED 01` are different beds.  
- Never give two physical monitors the same bed ID.

**Units & beds** panel: click a unit card to see that unit’s bed table (Vacant / Occupied). Occupied means a patient is admitted there — clinicians do that, not you.

## 7.6 Connect a device (the most important admin skill)

**Navigate:** Administration, panel **Connect a device**.

**Principle on screen:** *A monitor is never trusted to say which bed it’s in. Unmapped data is held here, never guessed.*

Three blocks:

### 7.6.1 Devices waiting to be connected (quarantine)

When a monitor sends data from an IP that is **not** mapped, it appears here: IP, first seen, message count.

**To connect:**

1. Choose **Device model** (must match the real device — wrong model = wrong parser, garbage or empty traces).  
2. Choose **Bed**.  
3. **Connect**.

The row moves to **Connected devices**. Within seconds, a clinician opening that bed should see vitals if a patient is admitted (or after admit). Waveforms need the gateway reachable from cloud.

Supported models include (list is live from the gateway): BPL VividVue, BPL Acura S1, Avi IW6000, Avi Viha DV10, BPL Penlon 320, Philips IntelliVue / MX550 / G40 / VM, Mindray Beneview, Draeger Savina / Evita, Schiller Neumovent, and others as deployed.

### 7.6.2 Connected devices

IP, bed, model. **Disconnect** removes the map. Use this when:

- the monitor is moved to another bay;  
- the IP changed;  
- the model was wrong.

After disconnect, map again. Do not leave two IPs on one bed.

### 7.6.3 Add a mapping manually

If you know the IP **before** the device is plugged in:

1. Device IP *  
2. Bed *  
3. Device model *  
4. **Add mapping**

Useful for go-live day: pre-map every bay.

### 7.6.4 Errors you will see

| Message | What you do |
|---------|-------------|
| Device gateway is not configured | Call **Super Admin**. They must set Device gateway URL on the hospital profile (or `DEVICE_INGESTION_URL` on an all-in-one). |
| Hospital device gateway is unreachable | Call **hospital IT**. VPN down, wrong URL, port 9050 firewalled from cloud. |
| Pick a device model first | You clicked Connect without a model. |
| Empty quarantine forever, no vitals | Monitor not sending, wrong destination IP/port, or still on another gateway. Biomedical. |

The panel refreshes about every 5 seconds.

## 7.7 Admission roster (not logins)

**Navigate:** Administration, **Admission roster** at the bottom.

This list feeds **Admissions → Assign doctor / Assign nurse**.

**Add staff:**

| Field | Notes |
|-------|--------|
| Full name | Required |
| Role | Intensivist, Physician, Consultant, ICU Nurse, Charge Nurse, Respiratory |
| Specialty | Optional, e.g. Critical care |
| Status | On duty / Off |
| Assigned beds | Optional hint, e.g. `BED-01, BED-02` |
| Phone / Email | Directory only — **does not create a login** |

**Save staff.**

**Roster table:**

- **ON DUTY / OFF** toggle — clinicians can still be assigned; duty is operational status.  
- **Remove** — confirm. Do not remove someone who is assigned on an open admission without a replacement plan.

If the roster is empty, Admissions will tell the doctor *no doctors/nurses — add to Staff roster under Administration*.

## 7.8 Users & Roles (logins)

**Navigate:** **Users & Roles**.

Two tabs: **Users** and **Roles**.

### 7.8.1 Create a clinician login

1. **Users** tab → **+ Create user**.  
2. Email * (cannot change later).  
3. Display name.  
4. Role (Intensivist and other hospital roles — **not** Super Admin / Hospital Admin).  
5. Temporary password.  
6. Optional **photo** (JPEG/PNG/WebP, 1 MB). This is what appears on their account chip.  
7. Save.

Tell them:

- Hub URL  
- Choose **Doctors & nurses**  
- Email + temp password  
- They will set their own password on first login  
- MFA will email (production) or show on screen (training)

**Inactive** users cannot sign in. Use Inactive instead of deleting when someone is on leave.

**Don’t** create a second Hospital Admin here. Extra hospital admins are created by **Super Admin** on Centers & Admins.

### 7.8.2 Edit a user

**Edit →** change name, role, photo, active flag. Email stays locked.

### 7.8.3 Roles and permissions

**Roles** tab. System roles have a **System** badge (name fixed). You may adjust description and permission ticks.

Permission groups (what you are granting):

| Group | Examples |
|-------|----------|
| Dashboards & analytics | Universal dashboard, unit dashboard, ICU analytics |
| Patients & admissions | View / admit / update / document / discharge |
| Bed monitor & vitals | Open bed, waveforms, trends |
| Alarms | View, acknowledge, configure thresholds |
| Clinical workflow | Notes, orders, scoring |
| Reports | View, export PDF/CSV |

Create a custom role if your hospital wants a “viewer only” nurse supervisor. Most sites use the seeded clinical roles.

**Note for trainers:** the current Sentra sidebar shows the standard clinical menu to clinical logins. Permissions still matter for API actions. Do not give `patient.delete` to someone who must not discharge.

## 7.9 Universal (hospital admin)

**Navigate:** **Universal**.

Read-only hospital picture:

- Ventilated / immediate patients (link to Analytics);  
- Active alarms (link to Alarms);  
- Unit cards: occupancy, risk, critical / warning / ventilator / inotropes — **not clickable into a bed**;  
- Deteriorating list: name, MRN, unit, bed, alert — bed is **text**, not a chart link.

**Empty state:** *No ICU units configured yet. Create units under Administration, then map a bedside device under Connect a device.*

This is how a nursing superintendent sees the house without sitting a specific bay.

## 7.10 Alarms (hospital admin)

**Navigate:** **Alarms**.

Alarm Center for the hospital: filter by center / unit, **Acknowledge All**, mute notifications (this browser), per-card **Acknowledge**.

Acknowledging **silences the Hub alert**. The monitor at the bed still alarms. You **cannot** open waveforms from here — that is a clinical action. If you need the trace, a doctor signs in as clinical.

Empty: *All beds are within configured limits in the last 30 minutes.*

## 7.11 Analytics (hospital admin)

**Navigate:** Tools → **Analytics**.

ICU Command Center: occupancy, census, ventilated count, score coverage, unit performance (**no** links to Overview), alarm breakdown, risk matrix, throughput.

Refresh is available; the page also polls. Ventilator counts come from **admitted patients flagged ventilated**, not from a fake device inventory.

## 7.12 Hospital Audit Log

**Navigate:** Tools → **Audit Log**.

This hospital only: sign-ins, user provisioning, role changes. Use it when someone says “I didn’t create that account.”

## 7.13 Hospital Admin weekly checklist

- [ ] Every physical ICU bay has a **bed** in Administration.  
- [ ] Every live monitor IP is **Connected** to the correct bed and **model**.  
- [ ] No duplicate bed IDs.  
- [ ] Quarantine list is empty (or explained).  
- [ ] Every working clinician has **both** a login and a roster row if they are assigned on admissions.  
- [ ] Photos for staff who want them on the chip.  
- [ ] Inactive logins for people who left.  
- [ ] Gateway errors reported to Super Admin the same day.

---

# 8. Doctors and nurses — using the ward

This chapter is the curriculum for clinical end users.

## 8.1 Your job in one paragraph

You care for patients on **this hospital’s** configured beds. You admit, watch, document, score, report, and discharge. You do not build the floor. If a bed is missing or a waveform is blank, that is Hospital Admin + biomedical, not a hidden clinical menu.

## 8.2 First login

1. Hub URL.  
2. **Doctors & nurses**.  
3. Email + password (temp password the first time).  
4. Complete profile if asked.  
5. MFA.  
6. Land on **Overview**.

If you see **Hospitals**, you are Super Admin. If you see **Administration** as your home, you are Hospital Admin. Wrong area.

## 8.3 The clinical menu — where to go

| Go here | When you want to |
|---------|------------------|
| **Overview** | Unit pulse: occupied beds, mini-waves, KPIs, alarm feed |
| **Patients** | Search the admitted list; jump to a bed |
| **Beds** | All bays vacant/occupied; click vacant to admit, occupied to chart |
| **Alerts** | Full physiological alert list; ACK; open waveforms |
| **Admissions** (Tools) | New admission, readmission, discharge |
| **Analytics** (Tools) | Hospital command center (clinical view; units link to Overview) |
| **Scoring** (Tools) | NEWS2, SOFA, APACHE II, RASS, CAM-ICU |
| **Reports** (Tools) | Clinical / complete / operational / compliance PDF or CSV |
| **Universal** (Tools) | All units, deteriorating patients, Alert Center sidebar |

**Patients** header also has a search box and **+ Admit**.

## 8.4 Overview

**KPIs:** Patients, Critical, Occupancy %, Active Alerts.

**Monitor grid:** up to eight occupied beds — bed ID, status, patient, diagnosis, live wave preview, HR / SpO₂ / BP / RR. Click a card → **bed detail**.

**Alert feed (right):** top alerts. Click → that bed’s waveforms. **ACK** after you have looked. **View all** → Alerts.

**Empty:** *No occupied beds yet* → **+ Admit patient**. That is normal on a new hospital.

**If occupied but no waves:** device not mapped or not sending. Tell Hospital Admin. Do not invent numbers in your head and type them as if they were live (typed snapshot on admission is different — see §8.8).

## 8.5 Patients

Table: patient (age, sex, MRN), bed, diagnosis, HR, SpO₂, status.

- Use header **Search** (name, bed, diagnosis, MRN).  
- Click a row → bed detail.  
- **+ Admit** → Admissions.

## 8.6 Beds

Every configured bay.

- **Free** → Admissions with that bed preselected (`/admissions?bed=…`).  
- **Occupied** → bed detail.  
- Unit label and status on the card.

**Empty grid:** Hospital Admin has not created units/beds. You cannot fix this from clinical. Call them.

## 8.7 Alerts

Full list: severity, title, patient, bed, value vs threshold.

- Click the row → **live waveforms** for that bed.  
- **ACK** silences the **Hub** alert after you reviewed. The physical monitor may still sound.  
- Copy on screen: *Click an alert to open live waveforms. Use ACK to silence after review.*

Do **not** ACK from the corridor without opening the patient. ACK is an operational “seen on Hub,” not a clinical all-clear.

## 8.8 Admissions — new patient

**Navigate:** Tools → **Admissions**, tab **New admission**.

Work top to bottom. Required fields are marked. You can **Save as draft** and come back.

### Step 1 — Demographics

| Field | Notes |
|-------|--------|
| Full name * | Legal name |
| MRN * | Hospital medical record number. **Must be unique.** If it already exists, use **Readmission**, do not invent a second MRN |
| External ID | Optional HIS id |
| Sex | M / F / as listed |
| Date of birth | Age calculates |
| Weight, height, blood group | Blood groups A+ … O- |
| Admission source | Default Emergency department |
| Referring physician | Optional |

### Step 2 — Admission details

| Field | Notes |
|-------|--------|
| Unit * | Created by Hospital Admin |
| Bed * | **Vacant only** |
| Type | e.g. Medical |
| Date/time | Defaults to now |
| Assign doctor * | From **admission roster** (not Users & Roles) |
| Assign nurse * | Same roster |
| Isolation | Contact, airborne, droplet, protective |
| Primary diagnosis | |

If doctor/nurse dropdowns are empty: Hospital Admin must add the roster.

### Step 3 — Clinical assessment

Comorbidities (chips: diabetes, hypertension, COPD, CKD, CAD, heart failure, obesity, immunosuppression, malignancy, liver disease, asthma, stroke). Provisional diagnosis, systemic exam, allergies, PMH, family history.

### Step 4 — Clinical snapshot

HR, BP, SpO₂, RR, temp, GCS, pain; flags **ventilated / inotropes / dialysis**.

This snapshot is **what you record at the door**. Live monitor values appear **after** the bed is mapped and sending. They are not the same field.

### Step 5 — Consent & policies

Consent: Obtained / Pending / Declined. Video monitoring (default on), audio monitoring (default off), research exclusion.

### Step 6 — Summary

Review the rail on the side. **Register & assign bed**.

Success: patient is on Overview / Patients / that bed card.

## 8.9 Admissions — readmission

Tab **Readmission**.

1. **Patient lookup** — search previous MRN / name.  
2. Then the same admission → assessment → snapshot → consent → summary path.  
3. **Readmit** assigns a **vacant** bed.

Use this when the MRN already exists. Do not create a second identity.

## 8.10 Admissions — discharge

Tab **Discharge**.

1. **Select bed** — occupied beds only.  
2. **Discharge summary:** reason, destination, follow-up, date/time.  
3. **Discharge patient**.

The bed becomes **Vacant**. History remains available for reports (discharged cohort).

Do not discharge to “free a bed” without completing the summary your hospital policy requires.

## 8.11 Universal (clinical)

**Navigate:** Tools → **Universal**.

Unlike Hospital Admin’s Universal:

- unit cards **open Overview**;  
- deteriorating **beds are links** to the chart;  
- **right sidebar Alert Center** with Acknowledge All, critical/ventilated stats, full feed.

Use this at the desk when you need the whole house, then click into the sickest bed.

## 8.12 Analytics (clinical)

Same command center as Hospital Admin, except unit performance rows can take you to **Overview**. Use for rounds: occupancy, alarm burden, score coverage.

## 8.13 Scoring

**Navigate:** Tools → **Scoring**.

Table of occupied patients with latest **NEWS2, SOFA, APACHE II, RASS, CAM-ICU**.

1. Click **Score** on a row (or select the row for history).  
2. Choose score type.  
3. **Autofill** pulls what vitals/labs exist — **you still verify**.  
4. Complete missing fields.  
5. **Preview**, add notes, **Save**.

**APACHE II** is limited to the **first 24 hours** after ICU admission. The form will tell you.

History chart: pick a score type under the patient.

Scoring does not replace clinical judgement. A green NEWS2 with a crashing patient is still a crashing patient.

## 8.14 Reports

**Navigate:** Tools → **Reports**.

| Type | Typical use |
|------|-------------|
| **Clinical Summary** | Shift / consultant summary for selected patients and date range |
| **Complete Patient Report (day-by-day)** | One patient’s ICU course. Pick the patient. Date range is not used the same way |
| **Operational Report** | Census / throughput style operations |
| **Compliance Report** | Documentation / process compliance view |

Set:

- Date range (except Complete Patient as designed);  
- Cohort: current vs discharged;  
- Units;  
- Patient search;  
- Vitals checklist where offered.

**Generate Report** → preview. **Download PDF** (landscape/portrait) or **CSV**.

If the cohort is empty, nobody matches the filters (wrong unit, discharged vs current).

## 8.15 Clinical daily rhythm (suggested)

| When | Screen |
|------|--------|
| Start of shift | Overview + Universal + Alerts |
| New arrival | Admissions → New or Readmission |
| At the bed | Bed detail: overview, waveforms, alarms |
| Documentation | Notes, orders, fluids, labs |
| Scores | Scoring after assessment |
| End of shift | Reports → Clinical Summary; Overview handoff |
| Leaving ICU | Discharge tab |

---

# 9. The bedside chart (bed detail)

**Navigate:** click a bed on Overview, Patients, Beds, Alerts, or Universal. URL like `/bed/BED-01`.

Header: back to Overview, patient banner (MRN, age, gender, assigned doctor/nurse), **Live** indicator.

**Tabs (left to right):**

1. Patient overview  
2. Live waveforms  
3. Trends  
4. Labs & Images  
5. Notes  
6. Orders  
7. Fluids  
8. Alarms  

Alerts deep-link to **Live waveforms**.

The chart refreshes on the order of every few seconds. It is **polling**, not a continuous vendor-monitor clone. Treat it as a **Hub view** of the bed, and still look at the physical monitor for primary alarming.

## 9.1 Patient overview

Vital tiles: HR, SpO₂, BP, RR, temperature, infusion-related values when the mapped device sends them.

If tiles are empty: unmapped device, wrong bed ID, monitor off, or VPN/gateway down. Banner copy will point you to **Connect a device** (Hospital Admin).

## 9.2 Live waveforms

ECG, SpO₂ (pleth), respiration when the gateway has those channels for this bed.

No trace:

- mapping missing or wrong model;  
- device not sending that channel;  
- VPN down (waveforms are in-memory on the hospital gateway).

Do not screenshot an empty panel into the legal record as “asystole.” Confirm the physical monitor.

## 9.3 Trends

Presets: **Live (5m), 6 hours, 12 hours, 24 hours, Custom range**. Tick parameters (SpO₂, HR, RR, temps, vent/infusion params when present). Charts plot what was stored from the device stream.

## 9.4 Labs & Images

Manual entry for this visit:

- **Lab:** test name, value, unit, reference range, flag (e.g. NORMAL).  
- **Imaging:** modality (e.g. X-RAY), study name, findings, impression.

You may upload a report image for **OCR assist** — always check extracted values before saving. This is not an interface to the hospital LIS unless your site has added one.

## 9.5 Notes

Create a note from templates, including:

- ICU Progress Note (systems)  
- SOAP / SBAR style hospital templates (as listed in the picker)

Fill, save. You can update notes you are allowed to edit. Use the template as a **prompt**, not as completed fiction. Blank lines should be filled or deleted.

## 9.6 Orders

Order types: **Medications, Labs, Imaging, Procedures, Diet, Activity**.

Medication fields: drug (formulary suggestions such as norepinephrine, meropenem, propofol, …), dose, route (IV, PO, SC, IM, SL, topical, inhaled), frequency (continuous, Q4H … STAT), duration, priority (Routine / STAT / PRN), notes.

**Approve** appears as Approved in the MAR-style list. **Discontinue** requires a reason (condition changed, duplicate, adverse reaction, other).

Filter history by type and status. This Hub orders module is **ICU documentation on Sentra**. Follow your hospital’s legal medication record policy (MAR in HIS vs this screen).

## 9.7 Fluids

**Intake** categories: Infusions, Fluids, Blood Products, Oral Intakes, Stat / PRN / Oral Medication, Other.

**Output** categories: Urine Output, Drainage Output, Other.

Intake modes:

- **One-time** — enter volume (mL).  
- **Running** — enter rate (mL/h) and start time; the Hub accumulates volume until you **Stop**.

Always **Stop** a running infusion on the Hub when it is stopped at the pump, or the calculated volume keeps rising.

## 9.8 Alarms tab (this bed)

- Feed of alarms for **this bed** + **ACK**.  
- **Alarm thresholds** panel: high/low limits per vital, enable/disable, **Save**.

Thresholds are stored **per clinician configuration for that bed id**. The bed id must match the mapped bed **exactly**. Save after edits. Invalid high < low is rejected.

Unlock audio in the browser if your site uses Hub alarm sound — browsers block sound until a click.

---

# 10. Shift playbooks

Use these as drill scripts in training. Each is 10–20 minutes.

## 10.1 Playbook — Super Admin onboards Hospital “Riverside”

1. Super Admin → Hospitals → **+ Add hospital**.  
2. Name `Riverside Clinic`, admin email of their IT lead, generate temp password, gateway blank if laptop / URL if VPN ready.  
3. Call the IT lead; give URL + **Hospital Admin** portal + temp password.  
4. Confirm they completed profile.  
5. Open Full info: hospital Active, one center, one admin.  
6. When they send the gateway IP, paste origin into Device gateway URL → Save.  
7. Ask them to complete §10.2.

## 10.2 Playbook — Hospital Admin opens a 4-bed ICU

1. Administration → unit `ICU1` / `Riverside ICU`.  
2. Beds `BED-01` … `BED-04`.  
3. Connect a device: map four IPs (or wait for quarantine and connect).  
4. Roster: one intensivist, one ICU nurse, both ON DUTY.  
5. Users: create logins for those two people; photos optional.  
6. Tell them: portal **Doctors & nurses**.  
7. Universal should show 1 unit, 0 occupied until admit.

## 10.3 Playbook — Doctor admits and sees a wave

1. Clinical login → Admissions → New.  
2. Unique MRN, vacant BED-01, assign the roster doctor and nurse.  
3. Register.  
4. Overview → BED-01 → Live waveforms.  
5. If empty: Hospital Admin Connect a device; biomedical check 7061/7062.

## 10.4 Playbook — Alarm

1. Thresholds on Alarms tab: set a limit you can trip in simulation, or wait for a real event in training.  
2. Alerts list shows the event.  
3. Click → waveforms.  
4. Treat the patient (real world).  
5. ACK on Hub.  
6. Explain to trainees: ACK ≠ monitor silence.

## 10.5 Playbook — Discharge and report

1. Admissions → Discharge → select bed → summary → Discharge.  
2. Reports → Complete Patient → select that patient → Generate → PDF.  
3. Confirm bed is vacant on Beds.

---

# 11. Do and don’t

## 11.1 All users

| Do | Don’t |
|----|--------|
| Pick the **correct area** on login | Try every portal with the same password “to see what happens” |
| Sign out on shared PCs | Leave a consultant session open at the desk |
| Treat Hub ACK as Hub-only | Assume the bedside monitor is silent |
| Report empty waveforms with **bed id + IP** | Map a second IP onto the same bed “just to try” |
| Use real emails in production | Use `123456` MFA on a live hospital |

## 11.2 Super Admin

| Do | Don’t |
|----|--------|
| One tenant per hospital, private center | Share demo `SENTRA_ICU` beds with a paying hospital |
| Same JWT secret on cloud and every gateway | Different secrets “for safety” — that **breaks** the proxy |
| Origin-only gateway URL | Credentials or paths in the URL |
| `HUB_AUTH_ENFORCED=true` | Turn enforcement off on a reachable network |
| Reset temp passwords out of band | Put temp passwords in group WhatsApp |

## 11.3 Hospital Admin

| Do | Don’t |
|----|--------|
| Create **login + roster** for working clinicians | Assume Users & Roles fills the admit dropdown |
| Match **device model** to hardware | Pick a random model so the Connect button lights up |
| Disconnect then remap when a monitor moves | Leave stale IPs |
| Keep quarantine empty | Ignore “waiting to be connected” for days |
| Inactive leavers’ logins | Delete audit-worthy accounts without a process |

## 11.4 Doctors and nurses

| Do | Don’t |
|----|--------|
| Readmit existing MRNs | Register a second MRN for the same human |
| Verify Autofill scores | Save APACHE II after 24 h as if it were valid |
| Stop running fluids on the Hub when the pump stops | Let running intake accumulate overnight |
| Open waveforms before ACK | ACK all from Universal to “clear the board” |
| Call Hospital Admin for missing beds | Look for a hidden Admin menu — it was removed from clinical |

## 11.5 Biomedical / hospital IT

| Do | Don’t |
|----|--------|
| Stable DHCP reservations | Changing IPs without telling Hospital Admin |
| Point devices at **hospital** 7061/7062 | Point devices at the cloud Hub |
| Keep VPN up | Expose 9050 or 7003 to the internet |
| Health `rabbit: true` after reboots | Edit another site’s `bed-map.json` by hand on USB |

---

# 12. When something is not working

There is no single public “Sentra helpdesk” inside the app. Escalation follows **role**. Fill this table with **your** phone numbers before training day.

## 12.1 Escalation matrix (fill in)

| Problem class | First call | Then |
|---------------|------------|------|
| Cannot log in (password / MFA email) | **Hospital Admin** (reset via Super Admin if they are the admin) | Super Admin / your platform on-call |
| Wrong portal / landed on the wrong home | User retrains §4 | Hospital Admin |
| Missing unit, bed, roster name | **Hospital Admin** | — |
| No login account | **Hospital Admin** → Users & Roles | Super Admin only if they need a second hospital admin |
| Monitor not in Connect a device | **Biomedical** (is it sending to 7061/7062?) | Hospital Admin mapping |
| Gateway not configured / unreachable | **Super Admin** (URL) + **Hospital IT** (VPN, :9050) | Your DevOps |
| `rabbit: false` on hospital health | **Hospital IT** (VPN, `HOSPITAL_RABBITMQ_URL`) | Super Admin (broker down?) |
| Waveforms empty, vitals present | Gateway/VPN; waveforms are in-memory | Biomedical model mismatch |
| Two beds, one stream | Hospital Admin: duplicate bedId mapping | — |
| Clinical bug / 500 errors | Hospital Admin captures time + screenshot | Super Admin / engineering |
| Patient harm / device emergency | **Bedside monitor + hospital emergency process** | Sentra is not the crash cart |

## 12.2 Messages and what they mean

| You see | Meaning | Who |
|---------|---------|-----|
| Credentials do not work in that area | Wrong portal or wrong role account | User |
| Inactive / contact platform administrator | Hospital or user deactivated | Super Admin |
| MRN already exists — use Readmission | Identity already on file | Clinician |
| Device gateway is not configured | No URL on hospital and no default env | Super Admin |
| Hospital device gateway is unreachable | Cloud cannot HTTP to :9050 | IT / VPN |
| No occupied beds yet | Nobody admitted, or you are looking at a new tenant | Clinician / Admin |
| No ICU units configured | Hospital Admin has not created units | Hospital Admin |
| No doctors/nurses on Admissions | Roster empty | Hospital Admin |
| All beds within limits | No Hub physiological alarms in the window | — |

## 12.3 Technical health (operators)

On cloud:

```bash
curl http://127.0.0.1:7020/api/alarm/active
curl http://127.0.0.1:7040/
```

On hospital gateway:

```bash
curl http://127.0.0.1:9050/health
```

Hub UI up but no waveforms: proxy may be fine; mapping or send path is not.

VPN drop: vitals already in RabbitMQ can still alarm; **Connect a device** and **live waves** pause until 9050 is reachable again.

## 12.4 What to capture in a ticket

1. Role and portal used.  
2. Hospital name.  
3. Bed id **exactly** as shown.  
4. Device IP and model.  
5. Time (with timezone).  
6. Screenshot of the panel, not a crop of the logo.  
7. Whether the **physical monitor** showed data at that time.

---

# 13. Frequently asked questions

### Sign-in and accounts

**Q. Why three login cards?**  
A. So a Super Admin password cannot open a ward, and a doctor password cannot open platform tooling. Same URL, different rooms.

**Q. I used the right password and it failed.**  
A. Wrong area, inactive user, hospital deactivated, or temp password already consumed (must complete profile).

**Q. Where is Forgot password?**  
A. Those routes return to login. Hospital Admin / Super Admin issues a **temp password reset**. Production MFA is email, not SMS.

**Q. Why do I see 123456?**  
A. Training mode. Production must email a random code. If you see 123456 in a real hospital, the site is misconfigured — call Super Admin immediately.

**Q. Can I change my photo?**  
A. No. Hospital Admin uploads it on Users & Roles.

**Q. Can two people share one email?**  
A. No. One login per person. Shared accounts destroy the audit log.

### Super Admin

**Q. Why can’t I open Overview?**  
A. Super Admin is blocked from the ward. Use a clinical training account in a demo hospital if you need to teach Overview.

**Q. I created a hospital and doctors still see another ICU’s patients.**  
A. That was an old shared-center bug. New hospitals get an **empty private center**. Do not point two tenants at the same demo data. Check you are not logged into the demo hospital.

**Q. Gateway URL — HTTP or HTTPS?**  
A. HTTPS when the hospital puts TLS in front of :9050. HTTP is common on VPN-only lab networks. Origin only.

**Q. Can I set gateway URL as Hospital Admin?**  
A. No. Super Admin only. That is intentional.

### Hospital Admin

**Q. Where did Connectivity go?**  
A. It is **Connect a device** on **Administration**. `/connectivity` redirects there.

**Q. Why did ON DUTY on the roster once log people out?**  
A. Roster writes are Hospital Admin only. Clinical users must not patch roster. If a clinician is kicked to login when clicking duty, they are on the wrong screen — only Admin should toggle duty.

**Q. Doctor cannot be selected on admit.**  
A. Add them to **Admission roster**, not only Users & Roles.

**Q. Doctor cannot log in.**  
A. Add them under **Users & Roles**, not only the roster.

**Q. Unmapped device — can I type the bed from the HL7 PID?**  
A. No. That is how the wrong patient gets the wrong waves. Map by IP.

### Clinical

**Q. Where is Admin / Staff in my menu?**  
A. Removed from the doctor UI. Configuration is Hospital Admin. Roster is not a clinical page.

**Q. Where are fluids?**  
A. Open the **bed** → tab **Fluids**. Not a top-level menu.

**Q. Where are waveforms?**  
A. Bed → **Live waveforms**, or click an item on Alerts / Overview.

**Q. Where is history / trends?**  
A. Bed → **Trends**.

**Q. How do I print a chart?**  
A. Tools → **Reports** → generate → PDF. There is no “print Overview”.

**Q. ACK vs Mute.**  
A. ACK is per alarm (or Acknowledge All on Alarm Center). Mute notifications is a **browser** preference on Hospital Admin Alarm Center. Neither stops the physical monitor.

**Q. Can I admit without a mapped device?**  
A. Yes. The bed will have no live vitals until Hospital Admin maps a sending monitor. You can still document.

**Q. Readmission vs New.**  
A. Same human, existing MRN → Readmission. New MRN only for a person never in this Hub hospital.

**Q. Why APACHE II blocked?**  
A. More than 24 hours since ICU admission. Use SOFA / NEWS2 instead.

### Devices and data

**Q. We swapped a Philips for a Mindray on the same IP.**  
A. Disconnect and Connect again with the **new model**. Old parser + new protocol = nonsense.

**Q. Two monitors, one bed on screen.**  
A. Two IPs mapped to one bedId. Disconnect one.

**Q. Simulation / demo vitals.**  
A. `simulation/simulate.js` is a **lab tool**. It is not a patient. Label demo MRNs clearly (`SIM-001`).

**Q. Does Sentra replace the monitor legally?**  
A. No. Primary alarming and display remain the certified device. Sentra is the Hub for the unit.

---

# 14. Training checklists

Photocopy these. Sign and file.

## 14.1 Super Admin — competent when they can

- [ ] Explain the three portals without notes  
- [ ] Add a hospital and read back the temp password to the trainer  
- [ ] Open hospital profile and state whether gateway is default or custom  
- [ ] Add a second hospital admin and reset a temp password  
- [ ] Find a LOGIN_SUCCESS in Audit Logs  
- [ ] Recite: JWT secret must match; OTP on-screen is not production  
- [ ] Recite: they cannot open waveforms as Super Admin  

**Trainer:** ____________  **Trainee:** ____________  **Date:** ____________

## 14.2 Hospital Admin — competent when they can

- [ ] Sign in on Hospital Admin portal  
- [ ] Create a unit and two beds  
- [ ] Map one device from quarantine **or** manual IP  
- [ ] Disconnect and remap correctly  
- [ ] Add roster intensivist + nurse  
- [ ] Create a clinical login with a photo  
- [ ] Show Universal occupancy without clicking into a bed  
- [ ] Explain Users vs Roster in one sentence  
- [ ] Know the two gateway error strings and who to call  

**Trainer:** ____________  **Trainee:** ____________  **Date:** ____________

## 14.3 Doctor / nurse — competent when they can

- [ ] Sign in on Doctors & nurses  
- [ ] Admit a patient to a vacant bed (unique MRN)  
- [ ] Find the patient on Overview, Patients, Beds  
- [ ] Open waveforms, trends, notes, orders, fluids, alarms  
- [ ] Add a one-time intake and an output  
- [ ] Save a NEWS2 (autofill + verify)  
- [ ] ACK an alert only after opening the bed  
- [ ] Discharge with a summary  
- [ ] Generate a PDF report  
- [ ] State who they call if the bed is missing vs if the wave is missing  

**Trainer:** ____________  **Trainee:** ____________  **Date:** ____________

## 14.4 Biomedical — competent when they can

- [ ] Show monitor destination IP = gateway, port 7061 or 7062  
- [ ] `curl` health `rabbit: true`  
- [ ] Identify the monitor IP on the Hub quarantine list  
- [ ] Not change IPs without Hospital Admin  

**Trainer:** ____________  **Trainee:** ____________  **Date:** ____________

---

# 15. Glossary

| Term | Meaning |
|------|---------|
| **Hub** | The Sentra ICU web application |
| **Alarm Engine** | Cloud API: auth, hospitals, vitals, alarms, proxy to gateway |
| **device-ingestion** | Hospital-LAN service that parses monitors and publishes vitals |
| **Gateway URL** | HTTP origin of that hospital’s device-ingestion, stored on the hospital by Super Admin |
| **Center** | ICU site record under a hospital (usually one per hospital) |
| **Unit** | ICU ward inside the center (`ICU1`, `MICU`) — Hospital Admin |
| **Bed / bedId** | Bay identifier. Must match mapping, vitals, and thresholds exactly |
| **Bed-map** | IP → bedId + deviceType. Source of truth for identity |
| **Quarantine** | Unmapped IPs waiting under Connect a device |
| **Portal / area** | Super Admin, Hospital Admin, or Clinical login room |
| **Hospital Admin** | Tenant operator for one hospital |
| **Super Admin** | Platform operator for all hospitals |
| **Roster (hub_staff)** | Names for admission assignment; not a login |
| **Users (hub_users)** | Logins with MFA and roles |
| **ACK** | Acknowledge Hub alarm |
| **MRN** | Medical record number, unique per hospital in this Hub |
| **Visit** | One ICU stay (admission to discharge) |
| **NEWS2 / SOFA / APACHE II / RASS / CAM-ICU** | Clinical scores on Scoring |
| **VPN** | Required path between hospital gateway and cloud broker/API |
| **Temp password** | One-time password until Complete profile |

---

# 16. Quick reference cards

## Card A — Super Admin (keep at the NOC)

```
URL → Super Admin portal → MFA
Home = Hospitals
Add hospital → name, admin email, temp password, gateway origin
Profile → gateway URL Save → Manage centers & admins → Audit
Never: Overview, admit, Connect a device
If Connect a device broken at a site: URL + VPN + JWT secret match
```

## Card B — Hospital Admin (keep in biomedical)

```
URL → Hospital Admin portal → MFA
Home = Administration
Unit → Beds → Connect a device (model + bed + IP)
Roster = names on admit
Users = logins + photos
Universal / Alarms / Analytics / Audit Log = watch, don’t chart
Doctor missing on admit → roster
Doctor can’t log in → Users
```

## Card C — Doctor / nurse (keep at the desk)

```
URL → Doctors & nurses → MFA
Overview = now    Patients = search    Beds = vacant/occupied
Admissions = New / Readmit / Discharge
Bed tabs = Overview | Waveforms | Trends | Labs | Notes | Orders | Fluids | Alarms
Alerts → open wave → then ACK
Reports = PDF     Scoring = NEWS2/SOFA/APACHE/RASS/CAM-ICU
No Admin menu. Missing bed = Hospital Admin. Empty wave = mapping/biomed.
```

## Card D — Ports (keep with IT)

```
Browsers        → Hub 443 / 7040
Monitors        → Hospital 7061 HL7 / 7062 JSON
Cloud → gateway → Hospital 9050 (VPN only)
Gateway → cloud → RabbitMQ 7003 / AMQPS
Never publish 9050 or 7003 on the internet
```

---

# 17. Two-day training agenda

Use this as a classroom timetable. Day 1 is operators. Day 2 is clinical. Biomedical joins the afternoon of Day 1.

## Day 1 — Platform and hospital configuration (08:30–17:00)

| Time | Session | Room | Who must attend |
|------|---------|------|-----------------|
| 08:30 | Three users, three portals, demo of wrong-portal failure | Classroom | Everyone |
| 09:00 | How data moves (monitor → gateway → Hub). No invented vitals. | Classroom | Everyone |
| 09:30 | Super Admin: add hospital, profile, gateway URL, second admin, audit | Live Hub | Super Admin + your engineer |
| 10:30 | Break | | |
| 10:45 | Production split vs laptop. JWT secret. VPN. Ports 7061/7062/9050 | Classroom | Super Admin, hospital IT, biomedical |
| 12:00 | Lunch | | |
| 13:00 | Hospital Admin: units, beds, naming rules | Live Hub | Hospital Admin + biomedical |
| 14:00 | Connect a device: quarantine, model, disconnect, manual map | Live Hub + one real or emulated monitor | Hospital Admin + biomedical |
| 15:15 | Break | | |
| 15:30 | Users vs roster (drill until nobody mixes them) | Live Hub | Hospital Admin |
| 16:15 | Universal / Alarms / Analytics / Audit for Hospital Admin | Live Hub | Hospital Admin, NS |
| 16:45 | Day 1 written quiz (§22) | | |

**Day 1 homework:** Hospital Admin creates the real go-live unit and bed list on paper (names only). Biomedical lists monitor IPs and models.

## Day 2 — Clinical (08:30–16:30)

| Time | Session | Who |
|------|---------|-----|
| 08:30 | Clinical portal, Overview, Patients, Beds, Alerts | Doctors + nurses |
| 09:30 | Admit a unique-MRN patient (paired) | |
| 10:15 | Bed detail tour: every tab | |
| 11:15 | Alarms: open wave, then ACK. Thresholds. | |
| 12:00 | Lunch | |
| 13:00 | Notes templates, orders, fluids (running vs one-time) | |
| 14:00 | Scoring + Reports PDF | |
| 15:00 | Discharge | |
| 15:30 | Who to call (escalation fill-in) | |
| 16:00 | Competency sign-off §14.3 | |

Do not certify a doctor who has not opened waveforms on a mapped bed.

---

# 18. Worked example — one patient through the system

Use these exact values in a **training** hospital only. Never use this MRN on a live tenant.

**Hospital:** Sentra Training Hospital  
**Unit:** `ICU1` / Medical ICU 1  
**Bed:** `BED-03`  
**Monitor IP:** `192.168.10.43`  
**Model:** BPL VividVue (HL7 → port 7061)

### 18.1 Super Admin already did

Hospital exists. Gateway reachable. Hospital Admin account active.

### 18.2 Hospital Admin

1. Administration → Create unit `ICU1` / `Medical ICU 1`.  
2. Add bed `BED-03`.  
3. Connect a device → manual map `192.168.10.43` → `BED-03` → BPL VividVue model from the dropdown.  
4. Roster: `Dr A. Rao`, Intensivist, ON DUTY; `Nurse K. Iyer`, ICU Nurse, ON DUTY.  
5. Users: `rao@training.hospital` role Intensivist; `iyer@training.hospital` role ICU Nurse. Temp passwords in sealed slips.

### 18.3 Dr Rao admits

Portal **Doctors & nurses**.

Admissions → New:

- Name: `Training, Adult Male`  
- MRN: `TRN-4403`  
- Sex M, DOB 1978-03-12  
- Source: Emergency department  
- Unit ICU1, bed BED-03  
- Doctor Dr A. Rao, Nurse K. Iyer  
- Diagnosis: `Community-acquired pneumonia — training`  
- Ventilated: yes (so Universal / Analytics show a ventilated count)  
- Consent: Obtained, video on, audio off  

Register & assign bed.

### 18.4 Confirm live data

Overview → BED-03 should show the name and, if the emulator/monitor is sending, HR/SpO₂. Open **Live waveforms**.

If empty: Hospital Admin checks Connected devices for `192.168.10.43`. Biomedical confirms destination 7061.

### 18.5 Document

- Notes → ICU Progress Note template → fill Neuro/CV/Resp in one sentence each → Save.  
- Orders → Medications → Ceftriaxone, dose per protocol, IV, QD, Routine → save.  
- Fluids → Intake one-time NS 500 mL; Output urine 200 mL.  
- Scoring → NEWS2 → Autofill → verify RR and SpO₂ → Save.

### 18.6 Report and discharge

Reports → Complete Patient → `TRN-4403` → Generate → PDF.  
Admissions → Discharge → BED-03 → destination Ward 4 → Discharge.  
Beds shows BED-03 **Free**.

---

# 19. Permission catalog (Hospital Admin → Roles)

These keys are what you tick when editing a role. Teach Hospital Admin to create a **read-only observer** by granting only `*.read` style keys.

### Dashboards & analytics

| Key | Label | Typical Intensivist | Typical ICU Nurse | Observer |
|-----|-------|---------------------|-------------------|----------|
| `dashboard.universal` | Universal dashboard | Yes | Yes | Yes |
| `dashboard.unit` | Unit dashboard | Yes | Yes | Yes |
| `kpi.read` | ICU analytics | Yes | Charge nurse | Yes |

### Patients & admissions

| Key | Label | Intensivist | ICU Nurse | Observer |
|-----|-------|-------------|-----------|----------|
| `patient.read` | View patients | Yes | Yes | Yes |
| `patient.create` | Admit patients | Yes | As policy | No |
| `patient.update` | Update records | Yes | Yes | No |
| `patient.write` | Clinical documentation | Yes | Yes | No |
| `patient.delete` | Discharge | Yes | As policy | No |

### Bed monitor & vitals

| Key | Label | Intensivist | ICU Nurse | Observer |
|-----|-------|-------------|-----------|----------|
| `bed.read` | Open bed monitor | Yes | Yes | Yes |
| `waveform.read` | Waveforms | Yes | Yes | Yes |
| `trends.read` | Vitals trends | Yes | Yes | Yes |

### Alarms

| Key | Label | Intensivist | ICU Nurse | Observer |
|-----|-------|-------------|-----------|----------|
| `alarm.read` | Alarm center | Yes | Yes | Yes |
| `alarm.ack` | Acknowledge | Yes | Yes | No |
| `alarm.config` | Thresholds | Yes | Charge nurse | No |

### Clinical workflow

| Key | Label | Intensivist | ICU Nurse | Observer |
|-----|-------|-------------|-----------|----------|
| `clinical_notes.read` | View notes | Yes | Yes | Yes |
| `clinical_notes.write` | Write notes | Yes | Yes | No |
| `orders.read` | View orders | Yes | Yes | Yes |
| `orders.write` | Manage orders | Yes | As policy | No |
| `scoring.read` | Scoring | Yes | Yes | Yes |

### Reports

| Key | Label | Intensivist | ICU Nurse | Observer |
|-----|-------|-------------|-----------|----------|
| `reports.read` | View reports | Yes | Yes | Yes |
| `reports.write` | Export PDF/CSV | Yes | Charge nurse | No |

**Hospital Admin** and **Super Admin** are not assigned through this picker. Super Admin creates hospital admins. Hospital Admin must not receive a clinical login “to be safe” — use the Hospital Admin portal.

---

# 20. Device models and ports

Pick the dropdown model that matches the **physical** device. Transport decides the port on the hospital gateway.

| Model key (examples) | Kind | Typical port |
|----------------------|------|--------------|
| BPL VividVue M10 / M12 | HL7 | 7061 |
| BPL Acura S1 (syringe pump) | HL7 | 7061 |
| BPL Penlon 320 (anesthesia) | HL7 | 7061 |
| Avi IW6000 (incubator) | HL7 | 7061 |
| Avi Viha DV10 (ventilator) | HL7 | 7061 |
| Mindray Beneview T5 | HL7 | 7061 |
| Nihon Kohden PVM-2703 | HL7 | 7061 |
| Schiller Neumovent | HL7 | 7061 |
| VM family | HL7 | 7061 |
| Philips G40 | HL7 | 7061 |
| Philips IntelliVue | JSON | 7062 |
| Philips MX550 | JSON | 7062 |
| Draeger Evita V600 | JSON | 7062 |
| Draeger Savina 300 | JSON | 7062 |

Default if a map has no model: BPL VividVue M10 (HL7). **Do not rely on the default** for a Philips JSON monitor.

The Connect a device dropdown is loaded **from the gateway**. If a model is missing, the gateway image is old — Super Admin / engineering updates device-ingestion, not the clinician.

---

# 21. Go-live day (hospital) — hour by hour

Assume VPN and cloud were proven yesterday.

| Time | Owner | Action | Pass when |
|------|-------|--------|-----------|
| 06:00 | Hospital IT | Gateway container up; `curl :9050/health` → `rabbit: true` | Health JSON ok |
| 06:15 | Super Admin | Confirm Device gateway URL pingable from cloud | Connect a device loads, not “unreachable” |
| 06:30 | Hospital Admin | Units and beds match the floor whiteboard | Every bay named |
| 07:00 | Biomedical | Each monitor destination = gateway IP + correct port; IPs reserved | Ping from gateway optional |
| 07:30 | Hospital Admin | Map every IP; quarantine empty | Connected list = bay count |
| 08:00 | Two clinicians | Log in Doctors & nurses; complete MFA | Overview loads |
| 08:15 | Intensivist | Admit **one** agreed test patient or wait for first real admit | Bed occupied |
| 08:20 | Intensivist + biomed | Open waveforms on that bed | Trace or known empty channel documented |
| 08:45 | Hospital Admin | Photo + roster complete for the shift | Admit dropdowns populated |
| 09:00 | NS | Universal occupancy matches floor | Counts agree |
| 12:00 | Super Admin | Audit: hospital admin and clinician LOGIN_SUCCESS | Log exists |
| 16:00 | All | 15-minute huddle: issues list | Owners assigned |
| 22:00 | Night NS | Knows who to call from §12.1 | Sheet on the desk |

**Abort go-live** if gateway `rabbit: false` or Connect a device is unreachable. Do not admit a full ICU onto a Hub that cannot see monitors. Use the certified bedside monitors as today and delay Sentra rather than run a silent Hub.

---

# 22. Competency questions (with answers)

Trainers: give the question sheet without answers. Mark 80% to pass.

1. A doctor chooses Super Admin and types a correct password. What happens?  
   **Wrong area — sign-in fails.**

2. Who maps a monitor to a bed?  
   **Hospital Admin, Administration → Connect a device.**

3. Who can be selected as attending doctor on admit?  
   **A name on the admission roster, not merely a Users & Roles login.**

4. Where are fluids entered?  
   **Bed detail → Fluids tab.**

5. ACK on the Hub silences the physical monitor. True or false?  
   **False.**

6. Two IPs mapped to `BED-01`. What happens?  
   **Last writer wins. One stream overwrites the other.**

7. Existing MRN, patient returns to ICU. Which tab?  
   **Readmission.**

8. Who sets Device gateway URL?  
   **Super Admin only, hospital profile.**

9. Waveforms disappear, vitals still update. Likely cause?  
   **VPN/gateway HTTP path (waveforms in-memory on gateway). Vitals may already be in RabbitMQ.**

10. Clinical user looks for Admin in the sidebar.  
    **It is not there. Call Hospital Admin.**

11. MFA code 123456 appears in a paying hospital.  
    **Misconfiguration. Super Admin must disable `HUB_AUTH_DEV_EXPOSE_OTP` and enable SMTP.**

12. APACHE II greyed out 30 hours after admit.  
    **APACHE II is first 24 hours only.**

13. Running infusion left on Fluids overnight.  
    **Hub keeps accumulating mL until Stop.**

14. Photo on account chip. Who uploads?  
    **Hospital Admin, Users & Roles.**

15. Super Admin wants to see a waveform.  
    **They cannot on that login. Use a clinical training user in a demo hospital, or stand behind a clinician.**

---

# 23. Policies the hospital should write (Sentra does not replace these)

Sentra stores documentation. It does not decide your law or NABH/JCI process. Before go-live, the medical director should sign:

1. **Primary alarm policy** — certified monitor is primary; Hub is secondary.  
2. **ACK policy** — who may ACK, and that ACK requires visual contact with the patient or monitor.  
3. **Orders policy** — is Sentra the legal MAR, or is HIS the MAR and Sentra a worklist?  
4. **Admission identity policy** — one MRN per person; readmission rules.  
5. **Discharge policy** — required summary fields.  
6. **Break-glass** — how a Super Admin assists without using a shared doctor password.  
7. **Access review** — monthly inactive users.  
8. **Photo policy** — staff consent for badge photo on the chip.  
9. **Training records** — signed §14 checklists kept in HR.  
10. **Downtime procedure** — if Hub or VPN is down, paper + bedside monitors; do not invent Hub vitals later.

---

# 24. Super Admin — running many hospitals

You will eventually have tens of tenants. Operating model:

### Weekly

- Platform Analytics: idle hospitals (no AUTH in 7 days) — call their admin.  
- Audit: unexpected PLATFORM deletes.  
- Confirm each **Active** hospital still has ≥1 Active hospital admin.

### When a hospital adds a second campus

Prefer a **new hospital tenant** if they are legally/operationally separate (separate gateway, separate admins).  
Use a **second center** only if it is the same tenant, same admin team, two ICUs, still one VPN gateway (or you will need a product conversation — today’s design is **one gateway URL per hospital**).

### When a hospital leaves

1. Deactivate hospital.  
2. Confirm admins cannot log in.  
3. Leave audit in place.  
4. Hospital IT powers down gateway; revoke VPN.  
5. Do not reuse that hospital’s bed IDs on another tenant without a clean center.

### Your on-call bag

- Cloud Hub URL, Super Admin password manager (not a wiki).  
- Each site: gateway origin, VPN peer, hospital admin mobile.  
- JWT secret location (secrets manager, not chat).  
- This manual.

---

# 25. Clinical documentation — what each note template is for

On **Notes**, templates include:

| Template | Use |
|----------|-----|
| ICU Progress Note (systems) | Daily consultant / resident systems review |
| SOAP Note | Problem-oriented (Subjective, Objective, Assessment, Plan) |
| ICU Admission Note | First-day narrative (in addition to the Admissions form) |
| Nursing Shift / SBAR | Nursing handoff |
| Procedure Note | Line, intubation, etc. |
| Consultation Note | Visiting specialty |
| Significant Event / RRT | Arrest, RRT, unexpected deterioration |
| Discharge / Transfer Summary | Complements the Discharge tab; not a substitute for it |

Fill or delete blank prompt lines. A saved empty template is worse than no note.

---

# 26. Alarm thresholds — parameters you can set

On the bed **Alarms** tab, Hub thresholds include at least:

| Parameter | Unit |
|-----------|------|
| SpO₂ | % |
| Heart Rate (Pulse) | bpm |
| Temperature | °C |
| Respiratory rate | /min |

Enable a row, set high and/or low, **Save**. High must be greater than low. The bed id in config must match the mapped bed id **character for character**.

Hub limits do not reprogram the Philips/Mindray box. Set both if your policy says so.

---

# 27. Screen-by-screen index (for “where do I click?”)

| I want to… | Role | Click |
|------------|------|--------|
| Add a hospital | Super Admin | Hospitals → + Add hospital |
| Set gateway | Super Admin | Hospitals → Full info → Device gateway URL → Save |
| Extra hospital admin | Super Admin | Centers & Admins → + Add admin |
| Reset hospital admin password | Super Admin | Reset temp password |
| See all tenants’ audit | Super Admin | Audit Logs |
| Create ICU | Hospital Admin | Administration → Create ICU Unit |
| Add a bed | Hospital Admin | Administration → Add bed |
| Map a monitor | Hospital Admin | Administration → Connect a device |
| Add name for admit dropdown | Hospital Admin | Administration → Admission roster |
| Create a login | Hospital Admin | Users & Roles → + Create user |
| Upload photo | Hospital Admin | Users → Edit → photo |
| House occupancy | Hospital Admin or Clinical | Universal |
| Hospital alarm list without waves | Hospital Admin | Alarms |
| Unit live grid | Clinical | Overview |
| Find a patient | Clinical | Patients (header search) |
| See empty bays | Clinical | Beds |
| Admit | Clinical | Admissions → New, or Beds → free bay, or Patients → + Admit |
| Readmit | Clinical | Admissions → Readmission |
| Discharge | Clinical | Admissions → Discharge |
| Waveforms | Clinical | Bed → Live waveforms, or Alerts row |
| Vitals now | Clinical | Bed → Patient overview |
| Vitals over time | Clinical | Bed → Trends |
| Fluids | Clinical | Bed → Fluids |
| Labs / imaging | Clinical | Bed → Labs & Images |
| Notes | Clinical | Bed → Notes |
| Orders | Clinical | Bed → Orders |
| Bed alarms + limits | Clinical | Bed → Alarms |
| ACK list | Clinical | Alerts or Universal sidebar |
| Scores | Clinical | Scoring |
| PDF report | Clinical | Reports → Generate → Download PDF |
| Sign out | All | Sidebar bottom |

---

## Document control


| Item | Value |
|------|--------|
| Title | Sentra ICU Operator & Training Manual |
| Applies to | Multi-hospital Hub with hospital device-ingestion gateway |
| Clinical menu | Overview, Patients, Beds, Alerts, Admissions, Analytics, Scoring, Reports, Universal, bed-detail tabs |
| Hospital Admin menu | Universal, Administration (units/beds/devices/roster), Users & Roles, Alarms, Analytics, Audit Log |
| Super Admin menu | Hospitals, Centers & Admins, Platform Analytics, Audit Logs |
| Related | `CIS-Deployment/docs/HOSPITAL-GATEWAY.md`, `CIS-Deployment/deviceIngestion/docs/RUNBOOK.md` |

**Amendment:** When the product adds a screen, update the matching chapter **and** the quick cards in §16. Do not train from memory of an older sidebar (clinical Admin/Staff were removed on purpose).

---

*End of manual. Train in order: three users → correct portal → the person’s own chapter → one playbook with a live or simulated monitor.*
