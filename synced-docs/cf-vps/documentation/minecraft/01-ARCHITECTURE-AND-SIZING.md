---
title: "Minecraft Architecture & Resource Sizing (50% Host Envelope)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./README.md, ./02-PODMAN-QUADLET-SETUP.md, ../architecture/OVERVIEW.md]
tags: [minecraft, architecture, sizing, memory, cpu, arm64, cgroups]
---

# 01. Minecraft Architecture & Resource Sizing

> **TL;DR (non-technical):** This document defines the exact hardware boundaries for the Minecraft server.
> It takes exactly 50% of the server's processing power and memory (6 GB RAM and 2 processor cores),
> leaving the other 50% strictly reserved for the server's database, security systems, and web apps.

---

## 1. Host Hardware Baseline

The Madagascar production server (`krown`) runs on Oracle Cloud Infrastructure (OCI) Ampere A1 Compute:

| Hardware Component | Specification | Operational Role |
|---|---|---|
| **Architecture** | **ARM64 (aarch64)** | Ampere Altra Neoverse N1 cores (high IPC, predictable latency) |
| **Compute Shape** | **VM.Standard.A1.Flex** | 2 OCPU (translates to 4 dedicated vCPUs to the Linux kernel) |
| **System Memory** | **12.0 GB LPDDR4x** | High-bandwidth unified memory |
| **Storage Subsystem** | **150 GB NVMe Boot Volume** | High random read/write IOPS (>3,000 IOPS) |
| **Operating System** | **Ubuntu 26.04.1 LTS** | Linux Kernel 7.0.0, systemd cgroup v2 unified hierarchy |

### Current Host Baseline Footprint
At idle, core Madagascar platform daemons consume approximately **890 MB RAM** and **<3% CPU**:
- Security & Forensics: `auditd` (locked `-e 2`), `Laurel`, `Vector`
- Database: `PostgreSQL 18` (socket-only)
- Ingress & Tunnels: `cloudflared` (QUIC), `Nginx` (loopback only)
- Management: `cf-vps agent` (unprivileged, 256 MB cap)

This leaves **>11 GB RAM** and **~97% CPU** available for containerized application workloads.

---

## 2. The 50% Resource Allocation Budget

The user requirement mandates allocating **50% of server capacity** to the Minecraft workload:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           12.0 GB TOTAL HOST RAM                                │
├───────────────────────────────────────┬─────────────────────────────────────────┤
│        HOST PLATFORM & APPS           │           MINECRAFT SANDBOX             │
│              (50% / 6.0 GB)           │              (50% / 6.0 GB)             │
│                                       │                                         │
│  • Base OS & Daemons:  ~890 MB        │  • JVM Heap (-Xms/-Xmx):  4.5 - 5.0 GB  │
│  • PostgreSQL 18:     ~1.5 GB cap     │  • Metaspace & CodeCache: ~256 MB       │
│  • App Platform (web): ~1.5 GB cap    │  • Netty Off-Heap Buffers:~256 MB       │
│  • Linux Page Cache:   ~2.1 GB buffer │  • Thread Stacks & Native:~500 MB       │
└───────────────────────────────────────┴─────────────────────────────────────────┘
```

### Detailed Metric Breakdown

| Resource Parameter | Systemd Setting | Budget Value | Rationale |
|---|---|---|---|
| **Container Memory Ceiling** | `MemoryMax=6G` | **6144 MB** | Hard cgroup v2 limit. Container processes cannot exceed this under any condition. |
| **Memory Throttling Threshold** | `MemoryHigh=5.5G` | **5632 MB** | Soft limit. Triggers aggressive page cache reclamation before out-of-memory killing occurs. |
| **JVM Minimum Heap** | `-Xms4500M` | **4500 MB** | Pre-allocates heap at startup to avoid runtime page allocation latency during world loading. |
| **JVM Maximum Heap** | `-Xmx5000M` | **5000 MB** | Leaves exactly 1.0 GB of container memory headroom for off-heap allocations. |
| **CPU Quota** | `CPUQuota=200%` | **2.0 vCPUs** | Out of 400% total host capacity (4 vCPUs). Caps container at 50% compute utilization. |
| **CPU Scheduling Weight** | `CPUWeight=200` | High Priority | Gives the game tick thread priority over background batch processes (`vps-audit` is 100). |
| **Storage Allocation** | Persistent Mount | **25 GB Quota** | Located at `/srv/apps/minecraft/data` on high-speed NVMe storage. |

---

## 3. JVM Memory Anatomy (The 1 GB Off-Heap Rule)

A common mistake in Minecraft server administration is setting `-Xmx` equal to the container's memory limit.
In Java, the JVM consumes substantial memory **outside the heap**:

$$ \text{Total Memory} = \text{Heap} + \text{Metaspace} + \text{CodeCache} + \text{Off-Heap Buffers} + \text{Native Stacks} $$

```
[Total Container Limit: 6.0 GB]
┌───────────────────────────────────────────────────────────┬──────────────┐
│                  Java Heap (-Xmx5000M)                    │ Off-Heap Net │
│                       5.0 GB                              │    1.0 GB    │
└───────────────────────────────────────────────────────────┴──────────────┘
  ▲                                                           ▲
  │                                                           ├─ Metaspace (~256 MB)
  └─ World chunks, entities, tile entities, block states      ├─ Netty Network Buffers (~256 MB)
                                                              ├─ Thread Stacks (~200 MB)
                                                              └─ Garbage Collector Tables (~288 MB)
```

> [!CAUTION]
> **Why the 1.0 GB Headroom Matters**: If `-Xmx` were set to `6G`, Netty network buffers and JVM thread stacks
> would push total consumption to ~6.8 GB. Linux cgroup v2 would immediately trigger the **OOM Killer**
> and terminate the server process mid-game, causing chunk corruption. The 5.0 GB heap cap provides an unbreakable safety margin.

---

## 4. Host Safety & Isolation Invariants

The Minecraft workload is strictly constrained by Linux kernel cgroup v2 features in `app.slice`:

1. **Anti-Starvation Guard**: Even if an in-game redstone clock or TNT explosion pins container CPU usage, `CPUQuota=200%` guarantees that 2 vCPUs remain completely idle and available for the host OS and PostgreSQL.
2. **Forensic Plane Protection**: The host audit daemon (`auditd`) and log pipeline (`Vector`) run in `system.slice` with elevated scheduling priorities. Minecraft cannot overwhelm or suppress the audit record.
3. **No Direct Root Host Privileges**: The container executes with `UserNS=auto`, meaning the container's internal `root` user maps to an unprivileged subuid range (e.g. UID 100000) on the host. It holds zero Linux capabilities on `krown`.

---

## 5. Next Steps

Proceed to [`02-PODMAN-QUADLET-SETUP.md`](./02-PODMAN-QUADLET-SETUP.md) to inspect the complete Podman Quadlet container
configuration and filesystem layout.
