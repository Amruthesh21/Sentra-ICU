# Creates a RabbitMQ shovel to copy device.data.queue -> alarm-engine.device.data.queue
# Requires RabbitMQ management plugin on port 7004

param(
    [string]$RabbitHost = "localhost",
    [int]$RabbitPort = 7004,
    [string]$Username = "ICUcharting",
    [string]$Password = "admin@123",
    [string]$VHost = "ICUcharting"
)

$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
$headers = @{
    Authorization = "Basic $base64Auth"
    "Content-Type" = "application/json"
}

$vhostEncoded = [uri]::EscapeDataString($VHost)
$baseUrl = "http://${RabbitHost}:${RabbitPort}/api"

Write-Host "Declaring alarm-engine.device.data.queue..."
$queueBody = @{
    durable = $true
    auto_delete = $false
    arguments = @{}
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/queues/$vhostEncoded/alarm-engine.device.data.queue" `
        -Method Put -Headers $headers -Body $queueBody
    Write-Host "Queue declared."
} catch {
    Write-Host "Queue may already exist: $($_.Exception.Message)"
}

Write-Host "Creating shovel device-data-to-alarm-engine..."
$shovelBody = @{
    value = @{
        "src-protocol" = "amqp091"
        "src-uri" = "amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting"
        "src-queue" = "device.data.queue"
        "dest-protocol" = "amqp091"
        "dest-uri" = "amqp://ICUcharting:admin%40123@localhost:7003/ICUcharting"
        "dest-queue" = "alarm-engine.device.data.queue"
        "ack-mode" = "on-publish"
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Uri "$baseUrl/parameters/shovel/$vhostEncoded/device-data-to-alarm-engine" `
        -Method Put -Headers $headers -Body $shovelBody
    Write-Host "Shovel created successfully."
} catch {
    Write-Host "Shovel setup failed (enable shovel plugin if needed): $($_.Exception.Message)"
    Write-Host "See CIS-Deployment/scripts/RABBITMQ-SETUP.md for manual steps."
}

# Connect Engine publishes to nicu-device-exchange with routing key nicu-connect-device-data
Write-Host "Binding alarm-engine queue to nicu-device-exchange (nicu-connect-device-data)..."
$bindingBody = @{ routing_key = "nicu-connect-device-data"; arguments = @{} } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "$baseUrl/bindings/$vhostEncoded/e/nicu-device-exchange/q/alarm-engine.device.data.queue" `
        -Method Post -Headers $headers -Body $bindingBody
    Write-Host "Exchange binding created."
} catch {
    Write-Host "Exchange binding may already exist: $($_.Exception.Message)"
}
