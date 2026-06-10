'use client';

import { useState } from 'react';

// The browser runs this code, so it must reach the API through a port
// published on YOUR machine (localhost:4000) — not the Docker-internal
// hostname (api:4000), which only other containers can resolve.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACTIONS = [
  { label: 'Load products', path: '/api/products' },
  { label: 'Slow request', path: '/api/slow' },
  { label: 'Flaky request', path: '/api/error' },
];

export default function Home() {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  async function callApi(path) {
    setBusy(true);
    const startedAt = performance.now();
    let entry;
    try {
      const res = await fetch(`${API_URL}${path}`);
      const body = await res.json();
      entry = {
        path,
        status: res.status,
        ok: res.ok,
        latencyMs: Math.round(performance.now() - startedAt),
        body,
      };
    } catch (err) {
      entry = {
        path,
        status: 0,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        body: { error: String(err) },
      };
    }
    setResults((prev) => [entry, ...prev].slice(0, 5));
    setBusy(false);
  }

  return (
    <main>
      <h1>Observability Lab</h1>
      <p className="subtitle">
        Every click below produces logs (→ OpenSearch) and metrics (→ Prometheus).
      </p>

      <div className="buttons">
        {ACTIONS.map((a) => (
          <button key={a.path} onClick={() => callApi(a.path)} disabled={busy}>
            {a.label}
          </button>
        ))}
      </div>

      {results.map((r, i) => (
        <div key={i} className={`result ${r.ok ? '' : 'error'}`}>
          <div className="result-header">
            <span>
              GET {r.path} →{' '}
              <span className={r.ok ? 'status-ok' : 'status-error'}>
                {r.status || 'network error'}
              </span>
            </span>
            <span className="latency">{r.latencyMs} ms</span>
          </div>
          <pre>{JSON.stringify(r.body, null, 2)}</pre>
        </div>
      ))}

      <p className="hint">
        Tip: open <code>docker compose logs -f fluent-bit</code> or OpenSearch
        Dashboards at <code>localhost:5601</code> to watch these requests turn
        into log documents, and Grafana at <code>localhost:3001</code> to watch
        the metrics move.
      </p>
    </main>
  );
}
