# End-to-end test plan for the Infrastructure Monitoring Lab.
# Run: .\test-plan.ps1
#
# Each test prints PASS or FAIL with a short reason.

$ErrorActionPreference = 'Continue'
$passed = 0
$failed = 0
$results = @()

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Check
    )
    try {
        $ok = & $Check
        if ($ok) {
            $script:passed++
            $script:results += [pscustomobject]@{ Test = $Name; Result = 'PASS'; Detail = '' }
            Write-Host "  PASS  $Name" -ForegroundColor Green
        }
        else {
            $script:failed++
            $script:results += [pscustomobject]@{ Test = $Name; Result = 'FAIL'; Detail = 'Check returned false' }
            Write-Host "  FAIL  $Name" -ForegroundColor Red
        }
    }
    catch {
        $script:failed++
        $detail = $_.Exception.Message
        $script:results += [pscustomobject]@{ Test = $Name; Result = 'FAIL'; Detail = $detail }
        Write-Host "  FAIL  $Name - $detail" -ForegroundColor Red
    }
}

Write-Host "`n=== Infrastructure Monitoring Lab - Test Plan ===`n" -ForegroundColor Cyan

# ------------------------------------------------------------------ Core monitoring
Write-Host "Core: Node Exporter -> Prometheus -> Grafana" -ForegroundColor Yellow

Test-Check "Node Exporter /metrics is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:9100/metrics' -UseBasicParsing -TimeoutSec 5
    $r.Content -match 'node_cpu_seconds_total' -and $r.Content -match 'node_memory_MemTotal_bytes'
}

Test-Check "Prometheus is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:9090/-/healthy' -UseBasicParsing -TimeoutSec 5
    $r.StatusCode -eq 200
}

Test-Check "Prometheus target node-exporter is UP" {
    $t = Invoke-RestMethod -Uri 'http://localhost:9090/api/v1/targets' -TimeoutSec 10
    ($t.data.activeTargets | Where-Object { $_.labels.job -eq 'node-exporter' }).health -eq 'up'
}

Test-Check "PromQL node_cpu_seconds_total returns data" {
    $q = [uri]::EscapeDataString('node_cpu_seconds_total{job="node-exporter"}')
    $r = Invoke-RestMethod -Uri "http://localhost:9090/api/v1/query?query=$q" -TimeoutSec 10
    $r.status -eq 'success' -and $r.data.result.Count -gt 0
}

Test-Check "Grafana is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 10
    $r.StatusCode -eq 200
}

Test-Check "Grafana Prometheus datasource provisioned" {
    $ds = @(Invoke-RestMethod -Uri 'http://localhost:3001/api/datasources' -TimeoutSec 10)
    ($ds | Where-Object { $_.name -eq 'Prometheus' }).Count -gt 0
}

Test-Check "Grafana host metrics dashboard provisioned" {
    $d = @(Invoke-RestMethod -Uri 'http://localhost:3001/api/search?type=dash-db' -TimeoutSec 10)
    ($d | Where-Object { $_.uid -eq 'host-metrics' }).Count -gt 0
}

Test-Check "3 Grafana infrastructure alert rules provisioned" {
    $rules = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/provisioning/alert-rules' -TimeoutSec 10
    $rules.Count -ge 3
}

# ------------------------------------------------------------------ Optional demo app
Write-Host "`nOptional: Demo frontend + API" -ForegroundColor Yellow

Test-Check "Frontend responds (HTTP 200)" {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 10
    $r.StatusCode -eq 200
}

Test-Check "API /health returns ok" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 5
    $j.status -eq 'ok'
}

Test-Check "API /metrics is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:4000/metrics' -UseBasicParsing -TimeoutSec 5
    # Keep this generic: prom-client output contains at least the HELP/TYPE preamble.
    $r.StatusCode -eq 200 -and $r.Content -match '^#\s+HELP\s+'
}

Test-Check "Prometheus target api is UP" {
    $t = Invoke-RestMethod -Uri 'http://localhost:9090/api/v1/targets' -TimeoutSec 10
    ($t.data.activeTargets | Where-Object { $_.labels.job -eq 'api' }).health -eq 'up'
}

# ------------------------------------------------------------------ Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Green' })
Write-Host "  Total:  $($passed + $failed)`n"

if ($failed -gt 0) {
    Write-Host "Failed tests:" -ForegroundColor Red
    $results | Where-Object { $_.Result -eq 'FAIL' } | ForEach-Object {
        Write-Host "  - $($_.Test): $($_.Detail)"
    }
    exit 1
}

Write-Host "All tests passed. The monitoring lab is working." -ForegroundColor Green
exit 0
