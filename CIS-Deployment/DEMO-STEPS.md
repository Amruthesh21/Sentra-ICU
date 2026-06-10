# ICU Watch Alarm — Demo steps

## One-time setup (do this now, before demo day)

1. Start everything:
   ```powershell
   docker compose up --build -d
   ```

2. Wait 30 seconds, then verify shovel worked:
   ```powershell
   .\CIS-Deployment\scripts\verify-shovel.ps1
   ```
   You should see: **SUCCESS: alarm-engine.device.data.queue exists**

3. Get your ngrok URL:
   - Open http://localhost:4040 in browser
   - Copy the `https://xxxx.ngrok-free.app` URL

4. On your iPhone — open the ngrok HTTPS URL in Safari

5. Safari share button → **Add to Home Screen** → Add

6. Open **ICU Alerts** app from iPhone home screen

7. Login: name = **Dr. Demo**, doctorId = **doctor-001**

8. Tap **Notifications** tab → **Enable Notifications** → Allow (when iOS asks)

9. Tap **"Send test alarm to watch"** button  
   Your Apple Watch should buzz within 3 seconds

10. Confirm subscription saved:
    ```
    http://localhost:7030/api/subscriptions
    ```
    Should show your iPhone in the list

## On demo day

- Open http://localhost:7020/alarm-ui on the presentation screen
- Have iPhone with ICU Alerts app open on **My Patients** page
- Run test alarm:
  ```powershell
  Invoke-RestMethod -Uri "http://localhost:7030/api/test-push" -Method POST -ContentType "application/json" -Body '{"doctorId":"doctor-001"}'
  ```
  OR use the button in the app

## If watch does not buzz

Check in this order:

1. iPhone **Settings → Notifications → ICU Alerts → Allow Notifications** must be ON
2. **Apple Watch** app on iPhone → Notifications → Mirror iPhone must be ON
3. http://localhost:7020/alarm-ui — is alarm appearing in dashboard?
4. http://localhost:7030/api/subscriptions — is phone subscription there?
5. http://localhost:7004 → Queues → `alarm-engine.device.data.queue` — are messages flowing?
6. Re-run `verify-shovel.ps1` to confirm shovel is active

## Verify shovel plugin

If shovel setup fails, check RabbitMQ plugins:
```
http://localhost:7004/api/plugins
```
Ensure `rabbitmq_shovel` is in the enabled list. The shovel is the only reliable option since Connect Engine is JAR-only.
