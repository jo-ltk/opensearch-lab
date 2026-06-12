# Stress the Docker host CPU to trigger the "High CPU usage" Grafana alert.
# Run after the stack is up and Grafana alert rules are loaded.
#
#   .\stress-demo.ps1
#   .\stress-demo.ps1 -Seconds 180 -Cpus 4

param(
    [int]$Seconds = 180,
    [int]$Cpus = 4
)

Write-Host "Starting CPU stress for $Seconds seconds on $Cpus cores..."
Write-Host "Watch Grafana (http://localhost:3001) and Slack for the alert after ~2 minutes."
Write-Host ""

docker run --rm polinux/stress stress --cpu $Cpus --timeout "${Seconds}s"

Write-Host ""
Write-Host "Stress finished. CPU usage should drop and the alert will resolve."
