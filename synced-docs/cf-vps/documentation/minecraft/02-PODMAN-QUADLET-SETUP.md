---
title: "Podman Quadlet Container Engine Specification"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./README.md, ./01-ARCHITECTURE-AND-SIZING.md, ./03-NETWORKING-AND-DNS.md, ../operations/HOST-MODULES.md]
tags: [minecraft, podman, quadlet, systemd, containers, arm64]
---

# 02. Podman Quadlet Container Engine Specification

> **TL;DR (non-technical):** Instead of running a clunky background Docker program, the server uses
> Podman Quadlet to manage Minecraft directly through the Linux operating system. This makes the server
> start automatically when the machine boots, cleanly save worlds before shutting down, and stay
> completely locked inside a security sandbox.

---

## 1. Why Podman Quadlet over Docker?

The Madagascar platform standardizes on **Podman 5.7** natively integrated with **systemd** via **Quadlet**
([`host/50-podman`](../operations/HOST-MODULES.md)):

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Traditional Docker Approach vs. Madagascar Native Podman Quadlet                     │
├──────────────────────────────────────────┬───────────────────────────────────────────┤
│ ❌ Docker Daemon                         │ ✅ Podman Quadlet (Madagascar Standard)   │
├──────────────────────────────────────────┼───────────────────────────────────────────┤
│ • Root daemon listening on socket        │ • Daemonless: direct process execution    │
│ • Container crashes bypass systemd cgroup│ • Supervised natively by systemd          │
│ • Auditd logs polluted by daemon chatter │ • Process accounting captures clean ticks │
│ • Requires Docker-specific tooling       │ • Standard systemctl and journalctl tools │
│ • Privileged port-binding risks          │ • Unprivileged user namespaces (UserNS)   │
└──────────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 2. Directory Hierarchy & Volume Mounts

World data is decoupled from container layers so that upgrading Minecraft versions or refreshing container images
never touches game save files.

```
/srv/apps/minecraft/
├── data/              <-- Persistent world data, server.properties, player stats, usercache
│   ├── world/         <-- Overworld chunk anvil files (.mca)
│   ├── world_nether/  <-- Nether dimension
│   ├── world_the_end/ <-- The End dimension
│   └── server.properties
├── plugins/           <-- Bukkit/Paper plugins (Geyser, Floodgate, Spark, CoreProtect)
├── bridge/            <-- HTTP companion health script (status.mjs)
└── backups/           <-- Local Zstandard compressed backup archives
```

### Host Setup Commands
Execute on `krown` with `sudo`:

```bash
# Create directory structure
sudo mkdir -p /srv/apps/minecraft/{data,plugins,bridge,backups}

# Podman user namespace mapping (subuid 100000 corresponds to container UID 1000)
sudo chown -R 100000:100000 /srv/apps/minecraft/data
sudo chown -R 100000:100000 /srv/apps/minecraft/plugins
sudo chmod 750 /srv/apps/minecraft/data
```

---

## 3. The Quadlet Container Unit

Quadlet translates declarative `.container` files into full systemd service units automatically.

**File Location:** `/etc/containers/systemd/app-minecraft.container`

```ini
[Unit]
Description=Minecraft Dedicated Server (PaperMC on ARM64)
After=network-online.target local-fs.target
Wants=network-online.target

[Container]
# Base Image: multi-arch official image with Java 21 LTS
Image=docker.io/itzg/minecraft-server:latest
ContainerName=app-minecraft
AutoUpdate=registry

# User Namespace: maps container root to host subuid range
UserNS=auto

# Volume Mounts: persistent state
Volume=/srv/apps/minecraft/data:/data:Z
Volume=/srv/apps/minecraft/plugins:/plugins:Z
Volume=/srv/apps/minecraft/bridge:/bridge:ro,Z

# Network Publishing
# 25565 TCP: Minecraft Java multiplayer
PublishPort=25565:25565/tcp
# 19132 UDP: Bedrock mobile/console multiplayer (Geyser)
PublishPort=19132:19132/udp
# 10001 TCP: Local HTTP companion health bridge (loopback only)
PublishPort=127.0.0.1:10001:8080/tcp

# Server Core Parameters
Environment=TYPE=PAPER
Environment=VERSION=1.21.1
Environment=EULA=TRUE
Environment=MEMORY=5G
Environment=USE_AIKAR_FLAGS=true
Environment=SERVER_NAME=Madagascar SMP
Environment=MOTD=§bMadagascar §7SMP §8| §aOnline & Monitored
Environment=MAX_PLAYERS=20
Environment=DIFFICULTY=normal
Environment=VIEW_DISTANCE=8
Environment=SIMULATION_DISTANCE=6
Environment=SPAWN_PROTECTION=0
Environment=ENABLE_RCON=true
Environment=RCON_PORT=25575
Environment=RCON_CMDS_STARTUP=/data/startup.txt
EnvironmentSecret=RCON_PASSWORD=minecraft-rcon-password

# Cgroup Resource Envelope (50% Host Allocation)
[Service]
Restart=always
RestartSec=10s
Slice=app.slice
MemoryMax=6G
MemoryHigh=5.5G
CPUQuota=200%
CPUWeight=200
TimeoutStopSec=60s

# Graceful Shutdown Hook: flushes chunks and saves world before termination
ExecStop=/usr/bin/podman exec app-minecraft rcon-cli stop

[Install]
WantedBy=multi-user.target
```

---

## 4. Key Configuration Breakdown

### 4.1 Graceful Shutdown (`ExecStop`)
When systemd stops or reboots the server, it runs:
```bash
ExecStop=/usr/bin/podman exec app-minecraft rcon-cli stop
```
`TimeoutStopSec=60s` gives PaperMC up to 60 seconds to kick players, save modified chunk regions to disk,
and exit cleanly. This completely prevents corrupted chunk files on system reboots.

### 4.2 Auto-Update Mechanism (`AutoUpdate=registry`)
When combined with `podman-auto-update.timer`, Podman automatically checks Docker Hub weekly for updated base
images (incorporating Java 21 security patches) and performs rolling restarts during scheduled maintenance windows.

### 4.3 User Namespace Sandboxing (`UserNS=auto`)
The `:Z` flag on volume mounts configures SELinux/container labels. `UserNS=auto` ensures that if an attacker
exploits a remote code execution vulnerability inside PaperMC or a malicious plugin, they break out only as
an unprivileged UID with zero access to the host's root filesystem, audit logs, or SSH keys.

---

## 5. Service Lifecycle Commands

```bash
# Generate systemd service unit from the Quadlet definition
sudo systemctl daemon-reload

# Start and enable the Minecraft service
sudo systemctl enable --now app-minecraft.service

# Check service status and real-time memory usage
sudo systemctl status app-minecraft.service

# View live streaming console output
sudo journalctl -u app-minecraft.service -f
```

---

## 6. Next Steps

Proceed to [`03-NETWORKING-AND-DNS.md`](./03-NETWORKING-AND-DNS.md) to configure the zero-cost multiplayer connection
for friends and enable Bedrock cross-play.
