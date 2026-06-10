$headers = @{Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("ICUcharting:admin@123"))}
$queues = Invoke-RestMethod -Uri "http://localhost:7004/api/queues/ICUcharting" -Headers $headers
$target = $queues | Where-Object { $_.name -eq "alarm-engine.device.data.queue" }
if ($target) {
    Write-Host "SUCCESS: alarm-engine.device.data.queue exists" -ForegroundColor Green
    Write-Host "Messages ready: $($target.messages_ready)" -ForegroundColor Cyan
    Write-Host "Message rate: $($target.'messages_details.rate')" -ForegroundColor Cyan
} else {
    Write-Host "FAIL: queue not found — shovel did not run correctly" -ForegroundColor Red
}
$shovels = Invoke-RestMethod -Uri "http://localhost:7004/api/parameters/shovel" -Headers $headers
Write-Host "Active shovels: $($shovels.Count)" -ForegroundColor Yellow
$shovels | ForEach-Object { Write-Host "  - $($_.name)" }
