---
title: "Minecraft Dedicated Server: Documentation Hub"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./01-ARCHITECTURE-AND-SIZING.md, ./02-PODMAN-QUADLET-SETUP.md, ./03-NETWORKING-AND-DNS.md, ./04-OBSERVABILITY-AND-MONITORING.md, ./05-BACKUPS-AND-DISASTER-RECOVERY.md, ./06-ADMINISTRATION-AND-TUNING.md, ../architecture/OVERVIEW.md]
tags: [minecraft, documentation, hub, index, podman, oci, arm64]
---

# 🎮 Minecraft Dedicated Server Documentation Hub

> **TL;DR (non-technical):** This documentation suite explains how the Madagascar platform's production
> host (`krown`) hosts a private, high-performance Minecraft world using exactly **50% of its resources**
> (6 GB RAM and 2 vCPUs on ARM64) at **$0.00 additional operating cost**. It runs inside a secure,
> unprivileged container, accepts direct connections from friends online for free (with cross-play for
> phones and consoles), and is monitored through the admin console just like our web applications.

---

## 🗺️ Documentation Directory Map

This guide is organized modularly so you can navigate directly to the specific area you need on GitHub:

```
documentation/minecraft/
├── README.md                          <-- You are here (Navigation hub & executive summary)
├── 01-ARCHITECTURE-AND-SIZING.md      <-- Host hardware, 50% resource budget, cgroups, JVM allocation
├── 02-PODMAN-QUADLET-SETUP.md         <-- Podman 5.7 Quadlet container, user namespaces, filesystem
├── 03-NETWORKING-AND-DNS.md           <-- Zero-cost multiplayer, OCI security list, Cloudflare DNS, Bedrock
├── 04-OBSERVABILITY-AND-MONITORING.md <-- Node.js monitoring parity, HTTP health bridge, Nginx, console
├── 05-BACKUPS-AND-DISASTER-RECOVERY.md<-- Automated R2 backups, zstd compression, point-in-time restore
└── 06-ADMINISTRATION-AND-TUNING.md    <-- PaperMC, Aikar G1GC flags, RCON cheatsheet, Spark profiling
```

### Quick Topic Matrix

| If You Want To | Read Document | Primary Focus |
|---|---|---|
| **Understand resource limits & sizing** | [`01-ARCHITECTURE-AND-SIZING.md`](./01-ARCHITECTURE-AND-SIZING.md) | 6 GB RAM, 2 vCPUs, cgroup v2, JVM heap sizing |
| **Inspect container unit & systemd files** | [`02-PODMAN-QUADLET-SETUP.md`](./02-PODMAN-QUADLET-SETUP.md) | Quadlet unit, `UserNS=auto`, volume mounts |
| **Connect friends for free & enable consoles** | [`03-NETWORKING-AND-DNS.md`](./03-NETWORKING-AND-DNS.md) | OCI ingress, DNS `A` + `SRV` records, GeyserMC |
| **Monitor server health & check uptime** | [`04-OBSERVABILITY-AND-MONITORING.md`](./04-OBSERVABILITY-AND-MONITORING.md) | Loopback HTTP bridge (`/healthz`, `/status`), Nginx |
| **Restore a lost/corrupted world** | [`05-BACKUPS-AND-DISASTER-RECOVERY.md`](./05-BACKUPS-AND-DISASTER-RECOVERY.md) | RCON snapshot, age encryption, R2 bucket restore |
| **Manage whitelist, OP users & fix lag** | [`06-ADMINISTRATION-AND-TUNING.md`](./06-ADMINISTRATION-AND-TUNING.md) | RCON commands, Aikar flags, Spark profiler |

---

## 🏛️ System Architecture Topology

The Minecraft server runs side-by-side with Madagascar platform services without compromising host security
or starving existing daemons:

```mermaid
graph TD
    subgraph Internet ["🌐 The Internet"]
        JavaFriends["PC Friends (Java Edition)<br>TCP 25565"]
        BedrockFriends["Console & Mobile Friends (Bedrock)<br>UDP 19132"]
        Owner["Operator / Owner<br>HTTPS Web Console"]
    end

    subgraph Edge ["🛡️ Cloudflare Edge"]
        CFDNS["Cloudflare DNS<br>mc.madagascarhotelags.com (A: DNS Only)<br>_minecraft._tcp.play (SRV: 25565)"]
        CFTunnel["Cloudflare Tunnel (QUIC)<br>krown-minecraft.madagascarhotelags.com (Access protected)"]
    end

    subgraph Host ["💻 Production Host (krown: Oracle Cloud A1 ARM64)"]
        subgraph Firewall ["Host Ingress"]
            OCI_SL["OCI VCN Security List<br>Permit TCP 25565 & UDP 19132"]
            IPTables["iptables DNAT forwarding"]
        end

        subgraph Container ["📦 Podman 5.7 Sandbox (app-minecraft.service)"]
            PaperMC["PaperMC 1.21.x (Java 21 LTS)<br>Heap: -Xms4.5G -Xmx5G (Aikar G1GC)"]
            Geyser["GeyserMC + Floodgate<br>Bedrock Translation Engine"]
            Bridge["HTTP Health Bridge (status.mjs)<br>Port 10001 (Loopback only)"]
            WorldData["World Storage<br>/srv/apps/minecraft/data"]
        end

        subgraph Monitoring ["📊 Observability & System Plane"]
            Systemd["systemd (app.slice)<br>MemoryMax=6G | CPUQuota=200%"]
            Journald["systemd-journald<br>Logs & Events Stream"]
            MetricsRecorder["cf-vps Agent Recorder<br>/var/lib/vps/metrics"]
            Nginx["Nginx Ingress (127.0.0.1:8080)<br>Reverse Proxy to Bridge"]
        end

        subgraph BackupPlane ["🔒 Durability & Storage Plane"]
            BackupTimer["vps-minecraft-backup.timer<br>Daily at 04:30 UTC"]
            ZstdArchive["Local zstd Tarball<br>/srv/apps/minecraft/backups/"]
            R2Sync["Cloudflare R2 Encrypted Bucket<br>backups/minecraft/ (30-day lock)"]
        end
    end

    JavaFriends --> CFDNS --> OCI_SL --> IPTables --> PaperMC
    BedrockFriends --> CFDNS --> OCI_SL --> IPTables --> Geyser --> PaperMC
    Owner --> CFTunnel --> Nginx --> Bridge --> PaperMC

    PaperMC --> WorldData
    Container -.-> Systemd
    Container -.-> Journald
    Container -.-> MetricsRecorder
    BackupTimer --> Container
    BackupTimer --> ZstdArchive --> R2Sync
```

---

## ⚡ Core Operational Guarantees

1. **Strict 50% Host Sandbox**: Systemd cgroup v2 strictly limits memory to **6.0 GB** and CPU to **2 vCPUs**. If the game container leaks memory or experiences runaway entity generation, systemd isolates and throttles only the game container, leaving host daemons (Postgres, Vector, Agent) completely unaffected.
2. **Zero Recurring Costs**: Oracle Cloud Always Free / Pay-As-You-Go includes 10 TB/month of outbound bandwidth and dedicated public IPs. Connecting friends over direct DNS costs $0.00.
3. **Zero Software Required for Friends**: Friends open vanilla Minecraft, add `play.madagascarhotelags.com`, and join immediately. No Hamachi, no client-side VPNs, no third-party launcher software.
4. **Console Parity with Web Apps**: You can monitor uptime, RAM consumption, and player activity from the `cf-vps` admin console or via `https://krown-minecraft.madagascarhotelags.com/status` behind Cloudflare Access.
5. **Nightly Off-Box Disaster Recovery**: The world is automatically flushed, compressed with Zstandard, encrypted with `age`, and pushed to Cloudflare R2 every night at 04:30 UTC.

---

> [!TIP]
> **Getting Started**: If you are deploying this for the first time, begin with [`01-ARCHITECTURE-AND-SIZING.md`](./01-ARCHITECTURE-AND-SIZING.md) to understand the resource envelope, followed by [`02-PODMAN-QUADLET-SETUP.md`](./02-PODMAN-QUADLET-SETUP.md) for step-by-step setup instructions.
