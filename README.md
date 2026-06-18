# Infrastructure Monitoring Lab

A beginner-friendly monitoring playground built with **Node Exporter**, **Prometheus**, **Grafana**, and **Slack**.

Learn how host metrics are collected, scraped, visualized, and turned into alerts — with minimal moving parts.

An optional **Next.js** frontend and **Express** API are included as a simple demo launcher. The monitoring stack does not depend on application metrics.

---

## Architecture

```text
                    User
                      ↓
               Next.js Frontend
                      ↓
                Node.js API
                      ↓
              Docker Container
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ↓             ↓             ↓

   New Relic      Fluent Bit   Node Exporter
        ↓             ↓             ↓
   APM Metrics    OpenSearch    Prometheus
        ↓             ↓             ↓
   New Relic UI  Dashboards      Grafana
                                      ↓
                                    Slack
```

---

## How It Works

### What is Node Exporter?

[Node Exporter](https://github.com/prometheus/node_exporter) is a Prometheus exporter that runs on a server and exposes hardware and OS metrics over HTTP at `/metrics`. It reports things like CPU time, memory, disk space, network I/O, and load averages — the building blocks of infrastructure monitoring.

In this lab, Node Exporter runs in Docker with read-only mounts to `/proc`, `/sys`, and the host root filesystem so it can read the underlying machine's stats.

### How does Prometheus scrape metrics?

Prometheus is a **pull-based** metrics database. On a schedule (`scrape_interval: 5s` in `prometheus/prometheus.yml`), it HTTP GETs each target's `/metrics` endpoint, parses the text format, and stores time series in its local database.

Check scrape health at:

```text
http://localhost:9090/targets
```

The `node-exporter` job should show **UP**. Try a query in the Prometheus UI:

```promql
rate(node_cpu_seconds_total{mode="idle"}[5m])
```

### How does Grafana query Prometheus?

Grafana does not store metrics itself. The provisioned **Prometheus** datasource points at `http://prometheus:9090` inside the Docker network. Dashboard panels run PromQL queries against that datasource and render graphs.

Open the **Host Metrics (Node Exporter)** dashboard:

```text
http://localhost:3001/d/host-metrics
```

### How are alerts sent to Slack?

Grafana evaluates alert rules every 30 seconds. When a condition stays true for the configured `for` duration, the alert moves **Pending → Firing** and Grafana sends a notification to the Slack incoming webhook in `SLACK_WEBHOOK_URL`.

Alert lifecycle:

```text
Normal → Pending → Firing → Resolved
```

---

## Prerequisites

* Docker Desktop (4GB+ RAM recommended)
* PowerShell
* A Slack incoming webhook URL (optional, for alert notifications)

---

## Quick Start

### 1. Configure Slack (optional)

Copy the example env file and set your webhook:

```powershell
copy .env.example .env
# Edit .env and set SLACK_WEBHOOK_URL
```

### 2. Start the stack

```powershell
docker compose up -d --build
```

### 3. Verify Node Exporter metrics

```powershell
# Raw metrics from Node Exporter
curl http://localhost:9100/metrics

# Prometheus sees the target as UP
start http://localhost:9090/targets

# PromQL: CPU idle rate (should return series)
curl "http://localhost:9090/api/v1/query?query=node_cpu_seconds_total"
```

### 4. Open Grafana

```powershell
start http://localhost:3001/d/host-metrics
```

You should see panels for **CPU Usage %**, **Memory Usage %**, **Disk Usage %**, **Network Traffic**, and **System Load**.

### 5. Run the automated test plan

```powershell
.\test-plan.ps1
```

### 6. Open the demo page

```text
http://localhost:3000
```

---

## Demo Flow

```text
Node Exporter collects server metrics
        ↓
Prometheus scrapes metrics every 5s
        ↓
Grafana visualizes metrics on the Host Metrics dashboard
        ↓
Alert threshold exceeded (e.g. CPU > 80%)
        ↓
Slack notification received
```

### Trigger a CPU alert

```powershell
.\stress-demo.ps1
```

This runs a short CPU stress container. After about 2 minutes, the **High CPU usage** alert should fire and Slack should receive a notification (if `SLACK_WEBHOOK_URL` is set). When stress stops, the alert resolves.

---

## Services

| Service        | URL                                      | Role                          |
| -------------- | ---------------------------------------- | ----------------------------- |
| Node Exporter  | http://localhost:9100/metrics            | Host metrics exporter         |
| Prometheus     | http://localhost:9090                    | Metrics storage + scraping    |
| Grafana        | http://localhost:3001                    | Dashboards + alerting         |
| Demo page      | http://localhost:3000                    | Grafana chart + Slack demo buttons |
| API            | http://localhost:4000                    | Optional sample backend       |

---

## Dashboard

**Infrastructure Monitoring → Host Metrics (Node Exporter)**

| Panel            | What it shows                                      |
| ---------------- | -------------------------------------------------- |
| CPU Usage %      | Non-idle CPU time across all cores                 |
| Memory Usage %   | RAM in use vs total                                |
| Disk Usage %     | Used space per filesystem                          |
| Network Traffic  | Receive/transmit bytes per second                  |
| System Load      | 1-, 5-, and 15-minute load averages                |

---

## Alert Rules

All rules are in `grafana/provisioning/alerting/alerting.yml` and route to Slack.

| Alert            | Condition                         | Duration |
| ---------------- | --------------------------------- | -------- |
| High CPU usage   | CPU > 80%                         | 2 min    |
| High memory usage| Memory > 80%                      | 2 min    |
| Low disk space   | Free space < 20% on a filesystem  | 5 min    |

---

## Useful PromQL Queries

```promql
# CPU usage %
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage %
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk free %
(node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100

# Network receive rate
sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))
```

---

## Useful Commands

```powershell
docker compose ps

docker compose logs prometheus --tail 50

docker compose logs grafana --tail 50

docker compose restart grafana

docker compose down

docker compose down -v
```

---

## Project Structure

```text
opensearch-lab/
│
├── prometheus/
│   └── prometheus.yml          # Scrape config (node-exporter + self)
├── grafana/
│   ├── dashboards/
│   │   └── host-metrics.json   # Host metrics dashboard
│   └── provisioning/           # Datasource, dashboards, alerts
├── frontend/                   # Optional demo launcher
├── api/                        # Optional sample API
├── docker-compose.yml
├── stress-demo.ps1             # Trigger CPU alert for demos
├── test-plan.ps1               # Automated verification
└── README.md
```

---

## Learning Goals

By completing this lab you will understand:

* What Node Exporter exposes and why
* How Prometheus pull-based scraping works
* How Grafana queries Prometheus with PromQL
* How to build infrastructure dashboards
* How Grafana alert rules evaluate thresholds
* How to route alert notifications to Slack
