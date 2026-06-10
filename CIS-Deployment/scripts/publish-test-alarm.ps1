# Publishes a test SpO2 breach message to alarm-engine.device.data.queue
param(
    [string]$RabbitHost = "localhost",
    [int]$RabbitPort = 7003,
    [string]$Username = "ICUcharting",
    [string]$Password = "admin@123",
    [string]$VHost = "ICUcharting",
    [double]$SpO2 = 85.0
)

$message = @{
    bedId = "ICU-1-BED-01"
    deviceType = "BplUltimaPrime"
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffK")
    primaryAttributes = @(
        @{ paramName = "SpO2"; value = $SpO2; unit = "%" }
        @{ paramName = "Pulse"; value = 89.0; unit = "bpm" }
        @{ paramName = "Temp1"; value = 36.8; unit = "°C" }
        @{ paramName = "Resp.Rate"; value = 13.0; unit = "bpm" }
    )
} | ConvertTo-Json -Depth 5 -Compress

Write-Host "Publishing test vitals (SpO2=$SpO2) to alarm-engine.device.data.queue..."
Write-Host $message

# Requires rabbitmqadmin on PATH, or use management HTTP API
$env:RABBITMQ_URL = "amqp://${Username}:$([uri]::EscapeDataString($Password))@${RabbitHost}:${RabbitPort}/${VHost}"

node -e "
const amqp = require('amqplib');
const msg = process.argv[1];
const url = process.env.RABBITMQ_URL;
(async () => {
  const conn = await amqp.connect(url);
  const ch = await conn.createChannel();
  await ch.assertQueue('alarm-engine.device.data.queue', { durable: true });
  ch.sendToQueue('alarm-engine.device.data.queue', Buffer.from(msg));
  console.log('Message sent.');
  await ch.close();
  await conn.close();
})().catch(e => { console.error(e.message); process.exit(1); });
" "$message"
