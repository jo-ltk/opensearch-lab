'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACTIONS = [
  {
    label: '🔥 Burn CPU',
    path: '/api/burn?seconds=120',
    description: 'Spikes API CPU for 2 minutes — watch Grafana',
  },
  {
    label: '💧 Create Memory Leak',
    path: '/api/leak',
    description: 'Retains 50 MB per click — repeat to trigger alerts',
  },
  {
    label: '❌ Generate Errors',
    path: '/api/error',
    description: '~30% chance of 500 — feeds logs and error-rate alerts',
  },
  {
    label: '🧹 Clear Memory Leak',
    path: '/api/leak?clear=true',
    description: 'Releases all leaked memory',
  },
];

const MONITORING_LINKS = [
  {
    label: '📊 Grafana',
    href: 'http://localhost:3001',
    description: 'Dashboards & alerts',
  },
  {
    label: '📈 Prometheus',
    href: 'http://localhost:9090',
    description: 'Metrics explorer',
  },
  {
    label: '🔍 OpenSearch Dashboards',
    href: 'http://localhost:5601',
    description: 'Structured log search',
  },
];

export default function ObservabilityDemo() {
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  async function runAction(action) {
    setBusy(action.path);
    try {
      const res = await fetch(`${API_URL}${action.path}`);
      const body = await res.json().catch(() => ({}));

      if (action.path.startsWith('/api/error')) {
        if (res.ok) {
          showToast(body.message || 'Request succeeded (200)', 'success');
        } else {
          showToast(
            body.error || `Error generated (${res.status})`,
            'warn'
          );
        }
      } else if (res.ok) {
        let detail = body.message || 'Action completed';
        if (body.retained_mb != null) {
          detail += ` — ${body.retained_mb} MB retained`;
        }
        showToast(detail, 'success');
      } else {
        showToast(body.error || `Request failed (${res.status})`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="demo-page">
      <nav className="top-nav">
        <Link href="/">← Tech Store</Link>
      </nav>

      <header className="card hero">
        <h1>📡 Observability Demo</h1>
        <p className="subtitle">
          Trigger CPU spikes, memory leaks, and errors on demand — then watch
          metrics, logs, and alerts update in real time.
        </p>
      </header>

      <section className="card demo-section">
        <h2>Actions</h2>
        <p className="section-desc">
          Each button calls the API and shows a toast with the result.
        </p>
        <div className="action-grid">
          {ACTIONS.map((action) => (
            <button
              key={action.path}
              className="action-btn"
              onClick={() => runAction(action)}
              disabled={busy !== null}
            >
              <span className="action-label">{action.label}</span>
              <span className="action-desc">{action.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card demo-section">
        <h2>Monitoring</h2>
        <p className="section-desc">
          Open these tools in a new tab to follow along during the demo.
        </p>
        <div className="monitoring-grid">
          {MONITORING_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="monitoring-link"
            >
              <span className="action-label">{link.label}</span>
              <span className="action-desc">{link.description}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
