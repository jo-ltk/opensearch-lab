'use client';

import Link from 'next/link';

const MONITORING_LINKS = [
  {
    label: '📊 Grafana',
    href: 'http://localhost:3001/d/host-metrics',
    description: 'Host Metrics dashboard and alert rules',
  },
  {
    label: '📈 Prometheus',
    href: 'http://localhost:9090/targets',
    description: 'Scrape targets and PromQL explorer',
  },
  {
    label: '🖥️ Node Exporter',
    href: 'http://localhost:9100/metrics',
    description: 'Raw host metrics endpoint',
  },
];

const DEMO_STEPS = [
  {
    title: '1. Start the stack',
    command: 'docker compose up -d --build',
  },
  {
    title: '2. Confirm Prometheus is scraping',
    command: 'Open http://localhost:9090/targets — node-exporter should be UP',
  },
  {
    title: '3. Open the Grafana dashboard',
    command: 'Infrastructure Monitoring → Host Metrics (Node Exporter)',
  },
  {
    title: '4. Trigger a CPU alert (optional)',
    command: '.\\stress-demo.ps1',
    note: 'Runs a short CPU stress test. After ~2 minutes, check Grafana alerting and Slack.',
  },
];

export default function ObservabilityDemo() {
  return (
    <main className="demo-page">
      <nav className="top-nav">
        <Link href="/">← Tech Store</Link>
      </nav>

      <header className="card hero">
        <h1>📡 Monitoring Demo Launcher</h1>
        <p className="subtitle">
          Quick links and steps for the Node Exporter → Prometheus → Grafana →
          Slack monitoring flow.
        </p>
      </header>

      <section className="card demo-section">
        <h2>Monitoring Tools</h2>
        <p className="section-desc">
          Open these in a new tab while you walk through the demo.
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

      <section className="card demo-section">
        <h2>Demo Flow</h2>
        <p className="section-desc">
          Node Exporter collects host metrics → Prometheus scrapes them → Grafana
          visualizes them → alert thresholds fire → Slack receives a notification.
        </p>
        <div className="action-grid">
          {DEMO_STEPS.map((step) => (
            <div key={step.title} className="action-btn" style={{ cursor: 'default' }}>
              <span className="action-label">{step.title}</span>
              <span className="action-desc">
                <code>{step.command}</code>
                {step.note ? ` — ${step.note}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
