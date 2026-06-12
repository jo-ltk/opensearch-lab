'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const DEMO_BUTTONS = [
  {
    label: '🔥 Burn CPU',
    path: '/api/demo/cpu?seconds=45',
    description: 'CPU % spikes in ~15s (runs 45s)',
  },
  {
    label: '💾 Consume Memory',
    path: '/api/demo/memory?mb=800',
    description: 'Memory % climbs in ~5s',
  },
  {
    label: '💽 Fill Disk',
    path: '/api/demo/disk?mb=200',
    description: 'Disk % ticks up in ~15s',
  },
  {
    label: '🌐 Generate Network Traffic',
    path: '/api/demo/network?seconds=30',
    description: 'Network spike in ~15s (runs 30s)',
  },
  {
    label: '📈 Increase System Load',
    path: '/api/demo/load?seconds=45',
    description: 'load1 rises in ~30s (runs 45s)',
  },
  {
    label: '🚨 Send Slack Alert (Demo)',
    path: '/api/demo/slack?alert=cpu',
    description: 'Sends: fake Grafana [FIRING] alert to Slack',
  },
];

export default function Home() {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState('');

  async function runDemo(button) {
    setBusy(button.path);
    setNote('');
    try {
      const res = await fetch(`${API_URL}${button.path}`);
      const body = await res.json();
      setNote(body.message || 'Demo started — check Grafana');
    } catch (err) {
      setNote(`Error: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="chart-demo">
      <header className="card hero">
        <h1>📡 Monitoring Demo</h1>
        <p className="subtitle">
          Click a button, then watch the matching chart move in Grafana at{' '}
          <a href="http://localhost:3001/d/host-metrics" target="_blank" rel="noopener noreferrer">
            localhost:3001/d/host-metrics
          </a>
        </p>
      </header>

      <div className="card">
        <div className="demo-buttons">
          {DEMO_BUTTONS.map((button) => (
            <button
              key={button.path}
              type="button"
              className="chart-demo-btn"
              onClick={() => runDemo(button)}
              disabled={busy !== null}
            >
              <span className="chart-demo-label">{button.label}</span>
              <span className="chart-demo-desc">{button.description}</span>
            </button>
          ))}
        </div>
        {note ? <p className="chart-demo-note">{note}</p> : null}
      </div>
    </main>
  );
}
