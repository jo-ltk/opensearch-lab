# Observability Learning Lab

A hands-on observability playground built with **Next.js**, **Express**, **Prometheus**, **Grafana**, **OpenSearch**, **Fluent Bit**, and **Slack**.

Generate real traffic, CPU spikes, memory leaks, and application errors with a single click, then watch logs, metrics, dashboards, and alerts update in real time.

---

## Architecture

```text
Browser
   |
   v
Next.js Frontend (:3000)
   |
   v
Express API (:4000)
   |
   +-------------------------------+
   |                               |
   | Metrics                       | Logs
   v                               v
Prometheus (:9090)           Fluent Bit
   |                               |
   v                               v
Grafana (:3001)             OpenSearch (:9200)
   |                               |
   | Alerts                        |
   +----------> Slack              |
                                   v
                      OpenSearch Dashboards (:5601)
```

---

## Features

### Frontend Demo UI

The Observability Demo provides one-click actions for generating real observability events.

Available at:

```text
http://localhost:3000/observability-demo
```

Actions:

* Burn CPU
* Create Memory Leak
* Clear Memory Leak
* Generate Errors

Monitoring shortcuts:

* Grafana
* Prometheus
* OpenSearch Dashboards

---

## Prerequisites

* Docker Desktop (4GB+ RAM recommended)
* PowerShell

---

## Quick Start

```powershell
docker compose up -d --build
```

Open:

```text
Frontend:
http://localhost:3000

Observability Demo:
http://localhost:3000/observability-demo
```

---

## Services

| Service               | URL                                      |
| --------------------- | ---------------------------------------- |
| Frontend              | http://localhost:3000                    |
| Observability Demo    | http://localhost:3000/observability-demo |
| API                   | http://localhost:4000                    |
| Metrics               | http://localhost:4000/metrics            |
| Prometheus            | http://localhost:9090                    |
| Grafana               | http://localhost:3001                    |
| OpenSearch            | http://localhost:9200                    |
| OpenSearch Dashboards | http://localhost:5601                    |
| cAdvisor              | http://localhost:8081                    |

---

## Demo Scenarios

### 1. CPU Alert Demo

Click:

```text
Burn CPU
```

What happens:

```text
API CPU increases
↓
cAdvisor collects metrics
↓
Prometheus scrapes metrics
↓
Grafana CPU graph rises
↓
Alert state:
Normal
→ Pending
→ Firing
↓
Slack notification sent
```

Alert:

```text
API container high CPU
```

Threshold:

```text
CPU > 0.5 cores for 2 minutes
```

---

### 2. Memory Alert Demo

Click:

```text
Create Memory Leak
```

Each click allocates approximately 50 MB.

Repeat several times until:

```text
Memory > 300 MB
```

Flow:

```text
Memory grows
↓
Prometheus records usage
↓
Grafana memory graph rises
↓
Memory alert fires
↓
Slack notification sent
```

Resolve:

```text
Clear Memory Leak
```

---

### 3. Error Rate Alert Demo

Click:

```text
Generate Errors
```

The API intentionally returns intermittent HTTP 500 responses.

Flow:

```text
500 errors generated
↓
Prometheus records failures
↓
Error rate increases
↓
Grafana alert fires
↓
Slack notification sent
```

---

## Observability Stack

### Metrics

Collected by:

```text
Prometheus
```

Useful queries:

```promql
sum by (route) (rate(http_requests_total[1m]))

sum(rate(http_requests_total{status=~"5.."}[1m]))

histogram_quantile(
  0.95,
  sum by (le)(
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

---

### Logs

Collected by:

```text
Fluent Bit
```

Stored in:

```text
OpenSearch
```

Viewed in:

```text
OpenSearch Dashboards
```

Useful searches:

```text
level:error

route:"/api/error"

status >= 500

grafana alert notification
```

---

### Dashboards

Grafana Dashboard:

```text
Observability Lab
└── API Observability (RED + Containers)
```

Monitor:

* Request Rate
* Error Rate
* Request Duration
* Container CPU
* Container Memory

---

## Alerts

### High Request Error Rate

Trigger:

```powershell
.\load-test.ps1 -OnlyErrors
```

Condition:

```text
5xx error rate > 5%
```

---

### API Container High CPU

Trigger:

```text
Burn CPU button
```

or

```powershell
curl http://localhost:4000/api/burn?seconds=240
```

Condition:

```text
CPU > 0.5 cores for 2 minutes
```

---

### API Container High Memory

Trigger:

```text
Create Memory Leak button
```

or

```powershell
curl http://localhost:4000/api/leak
```

Condition:

```text
Memory > 300 MB
```

Resolve:

```powershell
curl "http://localhost:4000/api/leak?clear=true"
```

---

## Slack Integration

Grafana alerts can be sent directly to Slack.

Alert lifecycle:

```text
Normal
↓
Pending
↓
Firing
↓
Resolved
```

Example Slack notifications:

```text
[FIRING] API container high CPU

[FIRING] High request error rate

[RESOLVED] API container high CPU
```

---

## Useful Commands

```powershell
docker compose ps

docker compose logs grafana --tail 50

docker compose logs fluent-bit --tail 50

docker compose logs api --tail 50

docker compose restart grafana

docker compose down

docker compose down -v
```

---

## Project Structure

```text
opensearch-lab/
│
├── api/
├── frontend/
├── fluent-bit/
├── prometheus/
├── grafana/
├── docs/
│
├── docker-compose.yml
├── load-test.ps1
├── setup-dashboards.ps1
└── README.md
```

---

## Learning Goals

By completing this lab you will understand:

* Structured logging
* Log aggregation
* Prometheus metrics
* RED metrics
* Grafana dashboards
* Alerting
* Slack notifications
* OpenSearch
* Fluent Bit
* Container monitoring
* End-to-end observability workflows
