# Learning Notes

Plain-language explanations of the concepts in this lab. Write your own version after completing each phase — that's how you know you understand it.

## Logs vs Metrics

| | Logs | Metrics |
|---|------|---------|
| **What** | Text events: "user X hit /api/products, took 120ms" | Numbers over time: "42 requests/sec" |
| **Question** | What happened? | How much / how fast? |
| **Storage** | OpenSearch | Prometheus |
| **Viewing** | OpenSearch Dashboards (Discover) | Grafana (panels) |
| **Model** | Push (app -> shipper -> store) | Pull (Prometheus scrapes app) |
| **Best for** | Debugging a specific request | Spotting trends and alerting |

**Analogy:** Logs are diary entries ("today I ate pizza at noon"). Metrics are a fitness tracker ("heart rate averaged 72 bpm this hour").

## Structured logging

Instead of:
```
GET /api/products 200 12ms
```

We log JSON:
```json
{"level":"info","route":"/api/products","status":200,"responseTime":12,"msg":"request completed"}
```

Machines can filter on `level:error` or `route:"/api/error"`. Plain text logs can't be searched this precisely.

## Push vs Pull

- **Push (logs):** The app prints to stdout. Fluent Bit receives and forwards to OpenSearch. The app doesn't know OpenSearch exists.
- **Pull (metrics):** The app exposes `/metrics`. Prometheus visits that URL every 5 seconds and copies the numbers. The app doesn't know Prometheus exists.

## Metric types

| Type | Behavior | Example | Query tip |
|------|----------|---------|-----------|
| **Counter** | Only goes up (resets on restart) | `http_requests_total` | Always use `rate()` or `increase()` |
| **Gauge** | Goes up and down | `process_resident_memory_bytes` | Query directly |
| **Histogram** | Distribution in buckets | `http_request_duration_seconds` | Use `histogram_quantile()` for percentiles |

## Labels and cardinality

Labels are key-value pairs on metrics: `http_requests_total{method="GET", route="/api/products", status="200"}`.

**Good labels:** method, route, status — a small, fixed set of values.

**Bad labels:** user ID, full URL with query params — unbounded values create millions of unique time series and crash Prometheus. This is called **high cardinality**.

## What Fluent Bit does

Fluent Bit is a lightweight log shipper. In this lab it:

1. Listens on port 24224 for logs pushed by Docker's fluentd driver
2. Parses the JSON inside each log line (pino output)
3. Writes parsed documents to OpenSearch

It's the glue between "app prints to stdout" and "logs are searchable in a database."

## What an index is

An OpenSearch **index** is like a database table. Logs go into daily indices: `app-logs-2026.06.10`. An **index pattern** (`app-logs*`) tells Dashboards to search across all daily indices.

## RED method

The three metrics every HTTP service should have:

- **R**ate — requests per second (`rate(http_requests_total[1m])`)
- **E**rrors — fraction of failed requests (`rate(...{status=~"5.."})`)
- **D**uration — how long requests take (`histogram_quantile(0.95, ...)`)

Our Grafana dashboard has one panel for each.

## Alert lifecycle

```
Normal -> Pending -> Firing -> Resolved
```

1. **Normal:** metric is below threshold
2. **Pending:** metric crossed threshold, but the `for` duration hasn't elapsed yet (prevents flapping)
3. **Firing:** threshold exceeded for the full `for` duration — notification sent
4. **Resolved:** metric dropped back below threshold

The `for` duration is critical. Without it, a single spike would page you at 3 AM.

## Why `rate()` on counters

Counters only go up: 100, 101, 102, 103... If you graph the raw value it always climbs. `rate()` calculates "how fast is this counter increasing per second" — that's the useful number.

## Docker networking in this lab

- **Browser -> container:** use `localhost:PORT` (Docker publishes ports to your machine)
- **Container -> container:** use the service name, e.g. `http://api:4000` (Docker Compose DNS resolves service names on the internal network)
- **Never** use `localhost` inside a container to reach another container — `localhost` inside a container means that container itself.

## Checkpoint answers (Phase 0)

1. **Image vs container:** An image is the frozen template (like a recipe). A container is a running instance of that image (like a meal made from the recipe).
2. **Why `api` can reach `opensearch:9200` but your browser can't:** Docker Compose creates an internal network where containers resolve each other by service name. Your browser is outside Docker and only sees ports published to `localhost`.
3. **Does Prometheus receive or fetch metrics?** Fetch (pull). Prometheus scrapes `/metrics` on a schedule.

## Checkpoint answers (Phase 3)

1. **Why counters need `rate()`:** Counters only increase, so the raw value isn't meaningful over time. `rate()` converts "total so far" into "per second right now."
2. **What is a histogram bucket:** A counter for requests that finished within a time range, e.g. `le="0.5"` means "requests that took 0.5 seconds or less." Percentiles are calculated from bucket counts.
3. **What happens if you label by user ID:** Every unique user creates a new time series. With thousands of users you get thousands of series, which overwhelms Prometheus memory. This is the cardinality problem.
