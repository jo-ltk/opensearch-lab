// Host-level demo actions — designed to move Node Exporter metrics on the Grafana dashboard.
// Demo only. Never use in production.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { Worker } = require('worker_threads');

const DEMO_DISK = process.env.DEMO_DISK_PATH || '/demo-disk';
const API_PORT = Number(process.env.PORT) || 4000;

const retainedMemory = [];
let cpuRunning = false;
let networkRunning = false;
let loadRunning = false;

function workerCount(multiplier = 2) {
  return Math.max(4, os.cpus().length * multiplier);
}

function startCpuBurn(seconds = 45) {
  if (cpuRunning) return { message: 'CPU burn already running — check Grafana now' };
  cpuRunning = true;

  const durationMs = seconds * 1000;
  const count = workerCount(2);
  const workers = [];

  const onWorkerDone = (worker) => {
    const idx = workers.indexOf(worker);
    if (idx >= 0) workers.splice(idx, 1);
    if (workers.length === 0) cpuRunning = false;
  };

  for (let i = 0; i < count; i += 1) {
    const worker = new Worker(
      `const { workerData } = require('worker_threads');
       const end = Date.now() + workerData.durationMs;
       while (Date.now() < end) Math.sqrt(Math.random());`,
      { eval: true, workerData: { durationMs } }
    );
    worker.on('exit', () => onWorkerDone(worker));
    worker.on('error', () => onWorkerDone(worker));
    workers.push(worker);
  }

  return {
    message: `CPU spike started (${count} cores, ${seconds}s) — chart should move in ~15s`,
  };
}

function startMemoryConsume(mb = 800) {
  const chunkMb = 80;
  const chunks = Math.ceil(mb / chunkMb);
  let added = 0;

  const tick = () => {
    if (added >= chunks) return;
    retainedMemory.push(Buffer.alloc(chunkMb * 1024 * 1024, 0xab));
    added += 1;
    if (added < chunks) setTimeout(tick, 400);
  };
  tick();

  const seconds = Math.ceil((chunks * 400) / 1000);
  return {
    message: `Memory ramp started (~${chunks * chunkMb}MB in ~${seconds}s) — watch Memory %`,
  };
}

function startDiskFill(mb = 200) {
  fs.mkdirSync(DEMO_DISK, { recursive: true });

  const filePath = path.join(DEMO_DISK, `demo-fill-${Date.now()}.bin`);
  const chunk = Buffer.alloc(25 * 1024 * 1024, 0xcd);
  const chunks = Math.ceil(mb / 25);

  setImmediate(() => {
    const fd = fs.openSync(filePath, 'w');
    try {
      for (let i = 0; i < chunks; i += 1) {
        fs.writeSync(fd, chunk);
      }
    } finally {
      fs.closeSync(fd);
    }
  });

  return {
    message: `Writing ~${mb}MB now — Disk % should tick up within ~15s`,
  };
}

function startNetworkPump(seconds = 30) {
  if (networkRunning) return { message: 'Network pump already running — check Grafana now' };
  networkRunning = true;

  const endAt = Date.now() + seconds * 1000;
  const timer = setInterval(() => {
    if (Date.now() >= endAt) {
      clearInterval(timer);
      networkRunning = false;
      return;
    }

    for (let i = 0; i < 40; i += 1) {
      http
        .get(`http://127.0.0.1:${API_PORT}/api/demo/payload?mb=5`, (res) => {
          res.on('data', () => {});
          res.on('end', () => {});
        })
        .on('error', () => {});
    }
  }, 50);

  return {
    message: `Network burst started (${seconds}s) — spike should show in ~15s`,
  };
}

function startLoad(seconds = 45) {
  if (loadRunning) return { message: 'Load test already running — check Grafana now' };
  loadRunning = true;

  fs.mkdirSync(DEMO_DISK, { recursive: true });

  const durationMs = seconds * 1000;
  const count = workerCount(3);
  const workers = [];

  const onWorkerDone = (worker) => {
    const idx = workers.indexOf(worker);
    if (idx >= 0) workers.splice(idx, 1);
    if (workers.length === 0) loadRunning = false;
  };

  for (let i = 0; i < count; i += 1) {
    const worker = new Worker(
      `const fs = require('fs');
       const path = require('path');
       const { workerData } = require('worker_threads');
       const end = Date.now() + workerData.durationMs;
       let n = 0;
       while (Date.now() < end) {
         Math.sqrt(Math.random());
         if (n++ % 800 === 0) {
           try {
             const p = path.join(workerData.diskPath, 'load-' + workerData.id + '-' + n + '.tmp');
             fs.writeFileSync(p, Buffer.alloc(2 * 1024 * 1024));
           } catch {}
         }
       }`,
      {
        eval: true,
        workerData: { durationMs, diskPath: DEMO_DISK, id: i },
      }
    );
    worker.on('exit', () => onWorkerDone(worker));
    worker.on('error', () => onWorkerDone(worker));
    workers.push(worker);
  }

  return {
    message: `Load spike started (${count} workers, ${seconds}s) — load1 rises in ~30s`,
  };
}

function payloadHandler(req, res) {
  const mb = Math.min(Math.max(parseInt(req.query.mb, 10) || 5, 1), 10);
  res.set('Content-Type', 'application/octet-stream');
  res.send(Buffer.alloc(mb * 1024 * 1024, 0x42));
}

const DEMO_ALERTS = {
  cpu: {
    title: 'High CPU usage',
    summary: 'Host CPU usage is above 80%',
    runbook: 'Stop the stress container or wait for the load to subside',
    severity: 'warning',
    value: '87.3%',
  },
  memory: {
    title: 'High memory usage',
    summary: 'Host memory usage is above 80%',
    runbook: 'Identify memory-heavy processes or restart the stress container',
    severity: 'warning',
    value: '84.1%',
  },
  disk: {
    title: 'Low disk space',
    summary: 'Filesystem has less than 20% free space',
    runbook: 'Free disk space on the affected mount point',
    severity: 'critical',
    value: '12% free',
  },
};

async function sendSlackAlert(alertKey = 'cpu') {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      ok: false,
      message: 'SLACK_WEBHOOK_URL is not set — add it to .env and restart the stack',
    };
  }

  const alert = DEMO_ALERTS[alertKey] || DEMO_ALERTS.cpu;
  const now = new Date().toISOString();

  const body = {
    username: 'Grafana',
    icon_emoji: ':rotating_light:',
    attachments: [
      {
        color: alert.severity === 'critical' ? '#E02F44' : '#FF9830',
        title: `[FIRING:1] ${alert.title}`,
        text: [
          '*Status:* Firing',
          `*Severity:* ${alert.severity}`,
          `*Folder:* Infrastructure Monitoring`,
          `*Value:* ${alert.value}`,
          `*Summary:* ${alert.summary}`,
          `*Runbook:* ${alert.runbook}`,
          `*Time:* ${now}`,
        ].join('\n'),
        footer: 'Grafana | Infrastructure Monitoring Lab',
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, message: `Slack webhook failed (${res.status}): ${detail}` };
  }

  return {
    ok: true,
    message: `Grafana-style alert sent to Slack — "${alert.title}"`,
  };
}

module.exports = {
  startCpuBurn,
  startMemoryConsume,
  startDiskFill,
  startNetworkPump,
  startLoad,
  payloadHandler,
  sendSlackAlert,
};
