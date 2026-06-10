# Demo: Trigger SpO2 Alarm

During the manager demo, temporarily lower SpO2 to 85% in the device simulation to trigger a CRITICAL alarm.

## What to change

In your **deviceSimulation** project, find where BplUltimaPrime vitals are generated for bed `ICU-1-BED-01`. Temporarily override SpO2:

```java
// DEMO ONLY — revert after 5 seconds
attributes.add(new VitalAttribute("SpO2", 85.0, "%"));
```

Or if using JSON/config, set:

```json
{ "paramName": "SpO2", "value": 85.0, "unit": "%" }
```

## Expected flow

1. Device sim publishes to `device.data.queue`
2. Shovel copies to `alarm-engine.device.data.queue`
3. Alarm engine detects SpO2 (85) < low threshold (90)
4. Publishes CRITICAL alarm to `alarm.notify.queue`
5. Notification service sends Web Push to subscribed doctors
6. Phone notification → watch vibrates

## Verify without watch

- Open http://localhost:7020/alarm-ui — alarm row should appear within 1–2 seconds
- Check notification service logs: `docker logs CIS-notification-service`

## Revert

Restore SpO2 to normal range (e.g. 98%) after ~5 seconds so the demo shows recovery.
