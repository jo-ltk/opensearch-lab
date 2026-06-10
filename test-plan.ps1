# End-to-end test plan for the Observability Learning Lab.
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

Write-Host "`n=== Observability Lab - Test Plan ===`n" -ForegroundColor Cyan

# ------------------------------------------------------------------ Phase 1
Write-Host "Phase 1: App + Docker" -ForegroundColor Yellow

Test-Check "Frontend responds (HTTP 200)" {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 10
    $r.StatusCode -eq 200 -and $r.Content -match 'Observability Lab'
}

Test-Check "API /health returns ok" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 5
    $j.status -eq 'ok'
}

Test-Check "API /api/products returns 4 products" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/api/products' -TimeoutSec 5
    $j.products.Count -eq 4
}

Test-Check "API /api/slow responds (may take up to 3s)" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/api/slow' -TimeoutSec 10
    $null -ne $j.delay_ms
}

Test-Check "API /api/error responds (200 or 500)" {
    try {
        Invoke-RestMethod -Uri 'http://localhost:4000/api/error' -TimeoutSec 5 | Out-Null
        $true
    }
    catch {
        $_.Exception.Response.StatusCode.value__ -eq 500
    }
}

# ------------------------------------------------------------------ Phase 2
Write-Host "`nPhase 2: Logs -> OpenSearch" -ForegroundColor Yellow

# Generate a few requests so logs exist
1..5 | ForEach-Object {
    Invoke-RestMethod -Uri 'http://localhost:4000/api/products' -TimeoutSec 5 | Out-Null
    try { Invoke-RestMethod -Uri 'http://localhost:4000/api/error' -TimeoutSec 5 | Out-Null } catch {}
}
Start-Sleep -Seconds 2

Test-Check "OpenSearch cluster is reachable" {
    $j = Invoke-RestMethod -Uri 'http://localhost:9200/_cluster/health' -TimeoutSec 10
    $j.status -in @('green', 'yellow')
}

Test-Check "app-logs index exists with documents" {
    $cat = Invoke-RestMethod -Uri 'http://localhost:9200/_cat/indices/app-logs*?format=json' -TimeoutSec 10
    $cat.Count -gt 0 -and [int]$cat[0].'docs.count' -gt 0
}

Test-Check "Logs contain structured pino fields (level, route)" {
    $q = '{"size":1,"query":{"exists":{"field":"route"}}}'
    $r = Invoke-RestMethod -Uri 'http://localhost:9200/app-logs-*/_search' -Method Post `
        -ContentType 'application/json' -Body $q -TimeoutSec 10
    $hit = $r.hits.hits[0]._source
    $null -ne $hit.level -and $null -ne $hit.route
}

Test-Check "OpenSearch Dashboards is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:5601' -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    $r.StatusCode -in @(200, 302)
}

Test-Check "Dashboards index pattern app-logs exists" {
    $r = Invoke-RestMethod -Uri 'http://localhost:5601/api/saved_objects/index-pattern/app-logs' `
        -Headers @{ 'osd-xsrf' = 'true' } -TimeoutSec 10
    $r.attributes.title -eq 'app-logs*'
}

Test-Check "Fluent Bit container is running" {
    $ps = docker compose ps fluent-bit --format json 2>$null | ConvertFrom-Json
    $ps.State -eq 'running'
}

# ------------------------------------------------------------------ Phase 3
Write-Host "`nPhase 3: Metrics -> Prometheus" -ForegroundColor Yellow

Test-Check "API /metrics exposes http_requests_total" {
    $m = Invoke-WebRequest -Uri 'http://localhost:4000/metrics' -UseBasicParsing -TimeoutSec 5
    $m.Content -match 'http_requests_total' -and $m.Content -match 'http_request_duration_seconds'
}

Test-Check "Prometheus is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:9090/-/healthy' -UseBasicParsing -TimeoutSec 5
    $r.StatusCode -eq 200
}

Test-Check "Prometheus target api is UP" {
    $t = Invoke-RestMethod -Uri 'http://localhost:9090/api/v1/targets' -TimeoutSec 10
    ($t.data.activeTargets | Where-Object { $_.labels.job -eq 'api' }).health -eq 'up'
}

Test-Check "Prometheus target cadvisor is UP" {
    $t = Invoke-RestMethod -Uri 'http://localhost:9090/api/v1/targets' -TimeoutSec 10
    ($t.data.activeTargets | Where-Object { $_.labels.job -eq 'cadvisor' }).health -eq 'up'
}

Test-Check "PromQL rate(http_requests_total) returns data" {
    $q = [uri]::EscapeDataString('sum(rate(http_requests_total[5m]))')
    $r = Invoke-RestMethod -Uri "http://localhost:9090/api/v1/query?query=$q" -TimeoutSec 10
    $r.status -eq 'success' -and $r.data.result.Count -gt 0
}

Test-Check "cAdvisor /metrics is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:8081/metrics' -UseBasicParsing -TimeoutSec 5
    $r.Content -match 'container_cpu_usage_seconds_total'
}

# ------------------------------------------------------------------ Phase 4
Write-Host "`nPhase 4: Grafana Dashboards" -ForegroundColor Yellow

Test-Check "Grafana is reachable" {
    $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 10
    $r.StatusCode -eq 200
}

Test-Check "Grafana Prometheus datasource provisioned" {
    $ds = @(Invoke-RestMethod -Uri 'http://localhost:3001/api/datasources' -TimeoutSec 10)
    ($ds | Where-Object { $_.name -eq 'Prometheus' }).Count -gt 0
}

Test-Check "Grafana RED dashboard provisioned" {
    $d = @(Invoke-RestMethod -Uri 'http://localhost:3001/api/search?type=dash-db' -TimeoutSec 10)
    ($d | Where-Object { $_.uid -eq 'api-observability' }).Count -gt 0
}

# ------------------------------------------------------------------ Phase 5
Write-Host "`nPhase 5: Alerts" -ForegroundColor Yellow

Test-Check "3 Grafana alert rules provisioned" {
    $rules = Invoke-RestMethod -Uri 'http://localhost:3001/api/v1/provisioning/alert-rules' -TimeoutSec 10
    $rules.Count -eq 3
}

Test-Check "Alert webhook endpoint accepts POST" {
    $body = '{"status":"test","alerts":[{"labels":{"alertname":"test-alert"}}]}'
    $r = Invoke-RestMethod -Uri 'http://localhost:4000/alert-hook' -Method Post `
        -ContentType 'application/json' -Body $body -TimeoutSec 5
    $r.received -eq $true
}

Test-Check "CPU burn endpoint starts" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/api/burn?seconds=5' -TimeoutSec 5
    $j.message -match 'burning'
}

Test-Check "Memory leak endpoint works" {
    $j = Invoke-RestMethod -Uri 'http://localhost:4000/api/leak?clear=true' -TimeoutSec 5
    $j.message -match 'released'
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

Write-Host "All tests passed. The observability lab is working." -ForegroundColor Green
exit 0
