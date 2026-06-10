# One-time setup for OpenSearch Dashboards: creates the app-logs* index pattern.
# Run after you've generated some traffic (so fields are detected).
#
#   .\setup-dashboards.ps1

$base = 'http://localhost:5601'

Write-Host "Creating index pattern app-logs* in OpenSearch Dashboards..."

$body = @{
    attributes = @{
        title         = 'app-logs*'
        timeFieldName = '@timestamp'
    }
} | ConvertTo-Json -Depth 5

try {
    $result = Invoke-RestMethod -Uri "$base/api/saved_objects/index-pattern/app-logs" `
        -Method Post `
        -ContentType 'application/json' `
        -Headers @{ 'osd-xsrf' = 'true' } `
        -Body $body
    Write-Host "Index pattern created: $($result.id)"
}
catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Index pattern already exists - you are good."
    }
    else {
        Write-Host "Error: $_"
        Write-Host "Make sure OpenSearch Dashboards is running and you've generated some API traffic first."
    }
}

Write-Host ""
Write-Host "Next steps (in the UI at http://localhost:5601):"
Write-Host "  1. Open Discover -> select 'app-logs*'"
Write-Host "  2. Set time range to 'Last 15 minutes'"
Write-Host "  3. Try DQL filter: level:error"
Write-Host "  4. Build visualizations: requests over time, errors by route"
