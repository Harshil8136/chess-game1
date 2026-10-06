---
title: "Observability, Telemetry & Console Monitoring Parity"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./README.md, ./01-ARCHITECTURE-AND-SIZING.md, ./02-PODMAN-QUADLET-SETUP.md, ../features/CONSOLE.md]
tags: [minecraft, observability, monitoring, nginx, cloudflare-tunnel, metrics]
---

# 04. Observability, Telemetry & Console Monitoring Parity

> **TL;DR (non-technical):** This document explains how the Minecraft server is monitored with the exact
> same visibility and control as the platform's Node.js web services. It includes a tiny internal web
> bridge that reports health, a web status dashboard behind Cloudflare Access, real-time log streaming
> in the admin console, and 30 days of minute-by-minute memory and CPU tracking.

---

## 1. The "Like a Node.js Server" Parity Architecture

In the Madagascar platform, Node.js applications (such as `hello`) possess five standard operational features:
1. **HTTP Health Checks**: An endpoint (`/healthz`) returning `200 OK` for automated uptime checks.
2. **Nginx Reverse Proxy**: Routed via `krown-<app>.madagascarhotelags.com` over the Cloudflare Tunnel.
3. **Protected Web Dashboard**: Reachable in any browser behind Cloudflare Access authentication.
4. **Console Log Streaming**: Real-time journal streaming in `/dashboard/vps/logs`.
5. **Historical Metrics Tracking**: Minute-by-minute cgroup tracking in `/dashboard/vps/metrics`.

Because Minecraft natively speaks the Minecraft binary protocol rather than HTTP, we deploy a lightweight
**Loopback HTTP Status Bridge** alongside the server to achieve 100% parity.

```
                              [Internet / Operator]
                                       │
                                       ▼
                       Cloudflare Tunnel (QUIC Tunnel)
                                       │
                                       ▼
                 Nginx Ingress Proxy (127.0.0.1:8080)
                 Server Name: krown-minecraft.madagascarhotelags.com
                                       │
                                       ▼
                 HTTP Companion Bridge (127.0.0.1:10001)
                     • GET /healthz ──> 200 OK
                     • GET /status  ──> JSON (Players, TPS, RAM)
                                       │
                                       ▼ (Server List Ping via Loopback)
                 PaperMC Dedicated Server (127.0.0.1:25565)
```

---

## 2. The HTTP Health & Status Companion Bridge

The bridge is a single, zero-dependency Node.js script located at `/srv/apps/minecraft/bridge/status.mjs`.
It speaks the Minecraft Server List Ping (SLP) protocol locally and responds in JSON format:

```javascript
#!/usr/bin/env node
// /srv/apps/minecraft/bridge/status.mjs
// Lightweight HTTP Companion Bridge for Madagascar Platform Monitoring
import http from 'node:http';
import net from 'node:net';

const MINECRAFT_PORT = 25565;
const HTTP_PORT = 8080; // mapped to host loopback 10001

function queryServer(host = '127.0.0.1', port = MINECRAFT_PORT, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, host);
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      // Handshake packet (protocol -1, status intent = 1)
      const hostBuf = Buffer.from(host, 'utf8');
      const handshake = Buffer.concat([
        Buffer.from([0x00]), // Packet ID: Handshake
        Buffer.from([0xff, 0xff, 0xff, 0xff, 0x0f]), // Protocol version: -1
        Buffer.from([hostBuf.length]), hostBuf,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        Buffer.from([0x01]) // Next state: Status (1)
      ]);
      const handshakeLength = Buffer.from([handshake.length]);
      socket.write(Buffer.concat([handshakeLength, handshake]));

      // Status Request packet
      socket.write(Buffer.from([0x01, 0x00]));
    });

    socket.on('data', (buf) => {
      try {
        const jsonStart = buf.indexOf(0x7b); // find opening '{'
        if (jsonStart !== -1) {
          const jsonStr = buf.toString('utf8', jsonStart);
          const data = JSON.parse(jsonStr);
          resolve(data);
        }
      } catch {
        resolve({ error: 'unparseable_status' });
      }
      socket.end();
    });

    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', (err) => { reject(err); });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.url === '/healthz') {
    try {
      await queryServer('127.0.0.1', MINECRAFT_PORT, 1500);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy', error: 'minecraft_unresponsive' }));
    }
  } else if (req.url === '/status') {
    try {
      const ping = await queryServer('127.0.0.1', MINECRAFT_PORT, 2500);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        server: {
          motd: typeof ping.description === 'string' ? ping.description : ping.description?.text,
          version: ping.version?.name,
          players: {
            online: ping.players?.online ?? 0,
            max: ping.players?.max ?? 20,
            list: (ping.players?.sample ?? []).map(p => p.name)
          }
        },
        system: {
          uptime_seconds: process.uptime(),
          node_version: process.version
        }
      }, null, 2));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`Minecraft HTTP bridge active on port ${HTTP_PORT}`);
});
```

---

## 3. Nginx Ingress Site Configuration

The HTTP companion bridge is reverse-proxied by Nginx (`host/55-nginx`) to receive requests from the Cloudflare Tunnel.

**File Location:** `/etc/nginx/conf.d/app-minecraft.conf`

```nginx
# Managed by cf-vps. Reverse proxy for Minecraft status bridge.
server {
    listen 127.0.0.1:8080;
    server_name krown-minecraft.madagascarhotelags.com;

    location / {
        proxy_pass http://127.0.0.1:10001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $http_cf_connecting_ip;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Integration with the `cf-vps` Console

Once deployed, Minecraft seamlessly integrates into all core console screens:

### 4.1 Services Screen (`/dashboard/vps/services`)
- Displays `app-minecraft.service` alongside system daemons.
- Shows real-time memory usage (e.g. `3.42 GB / 6.00 GB`), uptime, and active state.
- Operators holding the `services.control` capability can **Restart**, **Stop**, or **Start** the server with one click.

### 4.2 Logs Screen (`/dashboard/vps/logs`)
- Selecting unit `app-minecraft.service` streams live server output directly in your browser.
- Displays player logins, player deaths, chat messages, and command executions captured via `systemd-journald`.

### 4.3 30-Day Metrics Observatory (`/dashboard/vps/metrics`)
- The native agent recorder samples container CPU load, RAM allocation, and network I/O once per minute into `/var/lib/vps/metrics/`.
- Visualizes the 6 GB RAM ceiling, tick spikes, and player load across 1-hour, 24-hour, 7-day, and 30-day views with Bézier splines and magnetic laser hover crosshairs.

---

## 5. Live Browser Telemetry Dashboard

Because the site is protected by Cloudflare Access, navigating to:
```
https://krown-minecraft.madagascarhotelags.com/status
```
prompts for your corporate email login, then displays real-time live telemetry:

```json
{
  "ok": true,
  "server": {
    "motd": "§bMadagascar §7SMP §8| §aOnline & Monitored",
    "version": "Paper 1.21.1",
    "players": {
      "online": 3,
      "max": 20,
      "list": [
        "Steve",
        "Alex",
        "Harshil"
      ]
    }
  },
  "system": {
    "uptime_seconds": 184520,
    "node_version": "v24.1.0"
  }
}
```

---

## 6. Next Steps

Proceed to [`05-BACKUPS-AND-DISASTER-RECOVERY.md`](./05-BACKUPS-AND-DISASTER-RECOVERY.md) to set up automated nightly
Zstandard backups to Cloudflare R2.
