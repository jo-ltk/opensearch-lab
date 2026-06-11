'use client';

import { useState } from 'react';
import Link from 'next/link';

// The browser runs this code, so it must reach the API through a port
// published on YOUR machine (localhost:4000) — not the Docker-internal
// hostname (api:4000), which only other containers can resolve.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACTIONS = [
  {
    label: '🛍️ Load Products',
    path: '/api/products',
    activity: { icon: '✓', text: 'Products Loaded', tone: 'ok' },
  },
  {
    label: '⏳ Slow Request',
    path: '/api/slow',
    activity: { icon: '⚠', text: 'Slow Response', tone: 'warn' },
  },
  {
    label: '❌ Flaky Request',
    path: '/api/error',
    activity: { icon: '✗', text: 'Request Failed', tone: 'fail' },
  },
];

export default function Home() {
  const [results, setResults] = useState([]);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);

  async function callApi(action) {
    setBusy(true);
    const startedAt = performance.now();
    let entry;
    try {
      const res = await fetch(`${API_URL}${action.path}`);
      const body = await res.json();
      entry = {
        path: action.path,
        status: res.status,
        ok: res.ok,
        latencyMs: Math.round(performance.now() - startedAt),
        body,
      };
    } catch (err) {
      entry = {
        path: action.path,
        status: 0,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        body: { error: String(err) },
      };
    }
    setResults((prev) => [entry, ...prev].slice(0, 5));
    setActivity((prev) =>
      [
        { ...action.activity, time: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 6)
    );
    setBusy(false);
  }

  return (
    <main>
      <nav className="top-nav">
        <Link href="/observability-demo">Observability Demo →</Link>
      </nav>

      <header className="card hero">
        <h1>💻 Tech Store Observability Lab</h1>
        <p className="subtitle">
          This demo generates normal requests, slow requests, and errors so we
          can observe logs, metrics, dashboards, and alerts.
        </p>
      </header>

      <section className="card">
        <h2>Try It Out</h2>
        <div className="buttons">
          {ACTIONS.map((a) => (
            <button key={a.path} onClick={() => callApi(a)} disabled={busy}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="empty">No activity yet — click a button above.</p>
        ) : (
          <ul className="activity">
            {activity.map((a, i) => (
              <li key={i} className={`activity-item ${a.tone}`}>
                <span className="activity-icon">{a.icon}</span>
                <span className="activity-text">{a.text}</span>
                <span className="activity-time">{a.time}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Response</h2>
        {results.length === 0 ? (
          <p className="empty">Responses from the API will appear here.</p>
        ) : (
          results.map((r, i) => (
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
          ))
        )}
      </section>

      <p className="hint">
        Tip: open <code>docker compose logs -f fluent-bit</code> or OpenSearch
        Dashboards at <code>localhost:5601</code> to watch these requests turn
        into log documents, and Grafana at <code>localhost:3001</code> to watch
        the metrics move.
      </p>
    </main>
  );
}
