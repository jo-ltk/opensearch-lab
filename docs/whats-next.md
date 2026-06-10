# What's Next

You've built logs + metrics + dashboards + alerts. Here's what to explore when you're ready to go deeper.

## Distributed tracing (the third signal)

**What:** Follow a single request as it hops through services (frontend -> API -> database).

**Tools:** OpenTelemetry (instrumentation SDK) + Jaeger or Tempo (trace storage) + Grafana (visualization).

**Why:** Logs tell you something failed. Metrics tell you error rate spiked. Traces tell you *which specific request* failed and *where* in the call chain.

**Start here:** https://opentelemetry.io/docs/languages/js/

## Prometheus Alertmanager

**What:** This lab uses Grafana's built-in alerting. In production, Prometheus often sends alerts to a separate **Alertmanager** service that handles deduplication, grouping, silencing, and routing to PagerDuty/Slack/email.

**Start here:** https://prometheus.io/docs/alerting/latest/alertmanager/

## Loki (Grafana's log store)

**What:** An alternative to OpenSearch for logs. Loki stores log labels (metadata) in an index and log content in object storage — cheaper at scale. Grafana queries both Prometheus (metrics) and Loki (logs) in one UI.

**Start here:** https://grafana.com/docs/loki/latest/

## Kubernetes

**What:** In production, containers run on Kubernetes instead of Docker Compose. The observability concepts are identical, but the deployment model changes:

- Logs: DaemonSet running Fluent Bit on every node
- Metrics: Prometheus Operator or Grafana Agent
- Dashboards: Grafana as a Helm chart
- Alerts: Alertmanager or Grafana Cloud

**Start here:** https://kubernetes.io/docs/tutorials/

## OpenTelemetry Collector

**What:** A vendor-neutral pipeline that can receive logs, metrics, and traces and export them to any backend (OpenSearch, Prometheus, Jaeger, Datadog, etc.). Replaces ad-hoc Fluent Bit + prom-client setups with one unified pipeline.

**Start here:** https://opentelemetry.io/docs/collector/

## Production hardening checklist

Things we deliberately skipped in this lab:

- [ ] Enable OpenSearch security plugin (TLS + authentication)
- [ ] Don't run Grafana with anonymous admin access
- [ ] Set log retention policies (delete indices older than N days)
- [ ] Configure Prometheus remote write for long-term storage
- [ ] Add health checks and restart policies in docker-compose
- [ ] Use secrets management for passwords and API keys
- [ ] Set up proper alert routing (on-call rotation, escalation)
- [ ] Monitor the monitoring stack itself (meta-monitoring)

## Recommended learning path

1. **This lab** — logs, metrics, dashboards, alerts (you are here)
2. **Add tracing** — instrument the API with OpenTelemetry, view traces in Jaeger
3. **Try Loki** — replace OpenSearch with Loki, query logs in Grafana alongside metrics
4. **Deploy to a cloud VM** — run this stack on a single VPS, access via domain
5. **Kubernetes basics** — deploy the app to minikube/kind, add observability with Helm charts
6. **Read the SRE book** — https://sre.google/sre-book/table-of-contents/ (free online)

## Community dashboards to import in Grafana

| ID | Name | What it shows |
|----|------|---------------|
| 14282 | cAdvisor | Container CPU, memory, network |
| 3662 | Prometheus 2.0 Overview | Prometheus itself |
| 11159 | Node Exporter Full | Host-level metrics (if you add node-exporter) |

Import via Grafana -> Dashboards -> Import -> enter the ID.
