# Observability Learning Lab

A tiny Next.js + Express app wired into a full observability stack so you can learn logs, metrics, dashboards, and alerts hands-on.

## Architecture

```
Browser -> Next.js (:3000) -> Express API (:4000)
                                    |
                    +---------------+----------------+
                    |                                |
              JSON logs (stdout)              /metrics endpoint
                    |                                |
              Fluent Bit (:24224)              Prometheus (:9090)
                    |                                |
              OpenSearch (:9200)              Grafana (:3001)
                    |                                |
         OpenSearch Dashboards (:5601)           Alerts -> webhook -> API logs
```

## Prerequisites

- Docker Desktop (allocate at least **4 GB RAM** in Settings -> Resources)
- PowerShell (for the helper scripts)

## Quick start

```powershell
# Start everything (first run downloads images — allow 5-10 minutes)
docker compose up -d --build

# Generate traffic
.\load-test.ps1

# Set up the OpenSearch Dashboards index pattern (one-time)
.\setup-dashboards.ps1
```

## URLs

| Service | URL | What to look at |
|---------|-----|-----------------|
| Frontend | http://localhost:3000 | 3 buttons that generate traffic |
| API | http://localhost:4000/health | Health check |
| API metrics | http://localhost:4000/metrics | Raw Prometheus text format |
| OpenSearch | http://localhost:9200/_cat/indices?v | Indices and doc counts |
| OpenSearch Dashboards | http://localhost:5601 | Discover, visualizations |
| Prometheus | http://localhost:9090/targets | All targets should be UP |
| Grafana | http://localhost:3001 | RED dashboard + alerts |
| cAdvisor | http://localhost:8081 | Container metrics UI |

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/products` | Normal fast request |
| `GET /api/slow` | Random 0.5–3s delay (latency metrics) |
| `GET /api/error` | ~30% chance of 500 (error logs + alerts) |
| `GET /api/burn?seconds=120` | Burns CPU (triggers CPU alert) |
| `GET /api/leak` | Leaks 50 MB per call (triggers memory alert) |
| `GET /api/leak?clear=true` | Releases leaked memory |
| `POST /alert-hook` | Grafana webhook receiver (alert notifications become logs) |
| `GET /metrics` | Prometheus scrape target |
| `GET /health` | Health check |

## Generate load

```powershell
.\load-test.ps1                  # 60s mixed traffic
.\load-test.ps1 -Seconds 300     # 5 minutes
.\load-test.ps1 -OnlyErrors      # hammer /api/error (triggers error-rate alert)
```

## OpenSearch Dashboards setup

1. Run `.\setup-dashboards.ps1` (or create index pattern `app-logs*` manually in the UI)
2. Open **Discover** -> select `app-logs*`
3. Set time range to **Last 15 minutes**
4. Try DQL filters:
   - `level:error`
   - `route:"/api/error"`
   - `status >= 500`
5. Create visualizations:
   - **Requests over time** (date histogram on `@timestamp`)
   - **Errors by route** (terms aggregation on `route`, filter `level:error`)
6. Save both to a dashboard called "API Logs"

## Prometheus exercises

Open http://localhost:9090 -> **Graph** and run:

```promql
# Requests per second by route
sum by (route) (rate(http_requests_total[1m]))

# Error rate (5xx)
sum(rate(http_requests_total{status=~"5.."}[1m]))

# p95 latency
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

# OpenSearch container memory
container_memory_usage_bytes{name="opensearch"}
```

## Grafana

- Dashboard: **Observability Lab -> API Observability (RED + Containers)**
- Community dashboard: import ID **14282** (cAdvisor) via **Dashboards -> Import**

## Trigger alerts

| Alert | How to trigger | How to resolve |
|-------|----------------|----------------|
| High request error rate | `.\load-test.ps1 -OnlyErrors` for 2+ min | Stop the script |
| API container high CPU | `curl http://localhost:4000/api/burn?seconds=240` | Wait for burn to finish |
| API container high memory | Run `curl http://localhost:4000/api/leak` 6+ times | `curl "http://localhost:4000/api/leak?clear=true"` |

Watch alert lifecycle at http://localhost:3001/alerting/list (Normal -> Pending -> Firing -> Resolved).

Alert notifications are sent to `POST /api/alert-hook` and appear as logs in OpenSearch Dashboards (search for `grafana alert notification`).

## Run the test plan

Verify everything is working end-to-end:

```powershell
.\test-plan.ps1
```

This runs 24 automated checks across all 5 phases (app, logs, metrics, Grafana, alerts).

## Useful commands

```powershell
docker compose ps                          # container status
docker compose logs fluent-bit --tail 20   # log shipper
docker compose logs grafana --tail 20      # grafana + alerting
docker compose down                        # stop everything
docker compose down -v                     # stop + delete data volumes
```

## Project structure

```
opensearch-lab/
  api/                  Express + pino + prom-client
  frontend/             Next.js demo UI
  fluent-bit/           Log shipper config
  prometheus/           Scrape config
  grafana/              Datasources, dashboards, alerts (provisioned)
  docs/                 Architecture diagrams + learning notes
  docker-compose.yml
  load-test.ps1
  setup-dashboards.ps1
```

## Learn more

- [docs/architecture.md](docs/architecture.md) — system diagrams
- [docs/learning-notes.md](docs/learning-notes.md) — key concepts in plain language
- [docs/whats-next.md](docs/whats-next.md) — what to study after this lab
