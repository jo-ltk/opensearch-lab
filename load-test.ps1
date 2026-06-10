# Generates traffic against the lab API so logs and metrics have something to show.
#
#   .\load-test.ps1                 # 60 seconds of mixed traffic
#   .\load-test.ps1 -Seconds 300    # 5 minutes
#   .\load-test.ps1 -OnlyErrors     # hammer the flaky endpoint (triggers the error-rate alert)

param(
    [int]$Seconds = 60,
    [switch]$OnlyErrors
)

$base = 'http://localhost:4000'
$paths = if ($OnlyErrors) { @('/api/error') } else { @('/api/products', '/api/products', '/api/slow', '/api/error') }

$deadline = (Get-Date).AddSeconds($Seconds)
$ok = 0
$failed = 0

Write-Host "Sending traffic to $base for $Seconds seconds (Ctrl+C to stop)..."

while ((Get-Date) -lt $deadline) {
    $path = $paths | Get-Random
    try {
        Invoke-RestMethod -Uri "$base$path" -TimeoutSec 10 | Out-Null
        $ok++
    }
    catch {
        $failed++
    }
    Write-Host -NoNewline ("`r  ok: {0}   failed: {1}   " -f $ok, $failed)
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host "Done. $ok succeeded, $failed failed (failures from /api/error are expected!)."
Write-Host "Now look at:"
Write-Host "  - OpenSearch Dashboards http://localhost:5601  (logs)"
Write-Host "  - Prometheus            http://localhost:9090  (metrics)"
Write-Host "  - Grafana               http://localhost:3001  (dashboards + alerts)"
