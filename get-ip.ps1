# Quick script to get your local IP address
Write-Host "=== Your Local Network IP Addresses ===" -ForegroundColor Green
Write-Host ""

# Get all network adapters with IPv4 addresses
$adapters = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object IPAddress, InterfaceAlias

if ($adapters) {
    foreach ($adapter in $adapters) {
        Write-Host "Network: $($adapter.InterfaceAlias)" -ForegroundColor Cyan
        Write-Host "IP Address: $($adapter.IPAddress)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Frontend URL: http://$($adapter.IPAddress):5173/" -ForegroundColor Magenta
        Write-Host "WebSocket: ws://$($adapter.IPAddress):7654" -ForegroundColor Magenta
        Write-Host "---"
    }
} else {
    Write-Host "No network adapters found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Share the Frontend URL with devices on your network!" -ForegroundColor Green

