---
title: "Server Administration, Engine Tuning & Performance Profiling"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./README.md, ./01-ARCHITECTURE-AND-SIZING.md, ./04-OBSERVABILITY-AND-MONITORING.md, ./05-BACKUPS-AND-DISASTER-RECOVERY.md]
tags: [minecraft, papermc, aikar, g1gc, rcon, spark, performance, tuning]
---

# 06. Server Administration, Engine Tuning & Performance Profiling

> **TL;DR (non-technical):** This document contains the command cheatsheet for running the server day-to-day.
> It explains how to invite friends, make people admins, customize world rules, and use the built-in
> performance profiler (Spark) to eliminate lag if players build giant redstone machines or mob farms.

---

## 1. Engine Tuning: PaperMC & Aikar's G1GC Flags on ARM64

The server runs **PaperMC** on **Java 21 LTS** with Aikar's battle-tested G1GC garbage collection parameters.
These flags eliminate JVM garbage collection pauses, which are the #1 cause of tick latency and block lag.

### 1.1 The JVM Tuning Flag Matrix

```bash
JAVA_OPTS="-Xms4500M -Xmx5000M \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:+AlwaysPreTouch \
  -XX:G1NewSizePercent=30 \
  -XX:G1MaxNewSizePercent=40 \
  -XX:G1ReservePercent=20 \
  -XX:G1HeapWastePercent=5 \
  -XX:G1MixedGCCountTarget=4 \
  -XX:InitiatingHeapOccupancyPercent=15 \
  -XX:G1MixedGCLiveThresholdPercent=90 \
  -XX:G1RSetUpdatingPauseTimePercent=5 \
  -XX:SurvivorRatio=32 \
  -XX:+PerfDisableSharedMem \
  -XX:MaxTenuringThreshold=1"
```

| Flag | Purpose | Operational Benefit on ARM64 |
|---|---|---|
| `-XX:+UseG1GC` | Garbage-First Collector | Low-pause collector optimal for multi-gigabyte heaps |
| `-XX:+AlwaysPreTouch` | Pre-touches all memory pages at boot | Eliminates Linux page allocation stalls during gameplay |
| `-XX:MaxGCPauseMillis=200` | Target pause ceiling (200 ms) | Prevents noticeable player freezes during memory cleanups |
| `-XX:+ParallelRefProcEnabled` | Multi-threaded reference processing | Takes full advantage of the Ampere A1's dedicated Neoverse cores |
| `-XX:InitiatingHeapOccupancyPercent=15` | Early background marking cycle | Triggers GC before memory pressure spikes, preventing full GC stops |
| `-XX:SurvivorRatio=32` | Larger Eden space | Minimizes short-lived entity objects spilling into tenured space |

---

## 2. Complete RCON Administration Cheatsheet

All server commands are executed securely using `podman exec app-minecraft rcon-cli <command>`.

### 2.1 Allowlist & Access Control
Always enforce the allowlist to protect your private world from port scanners:

```bash
# Enable the whitelist
sudo podman exec app-minecraft rcon-cli whitelist on

# Add a friend to the allowlist
sudo podman exec app-minecraft rcon-cli whitelist add <MinecraftUsername>

# Remove a player from the allowlist
sudo podman exec app-minecraft rcon-cli whitelist remove <MinecraftUsername>

# List all allowlisted players
sudo podman exec app-minecraft rcon-cli whitelist list

# Reload allowlist from disk without restart
sudo podman exec app-minecraft rcon-cli whitelist reload
```

### 2.2 Operator (OP) & Moderation
```bash
# Grant OP permissions (Level 4 Operator)
sudo podman exec app-minecraft rcon-cli op <MinecraftUsername>

# Demote operator back to normal player
sudo podman exec app-minecraft rcon-cli deop <MinecraftUsername>

# Kick a player with a message
sudo podman exec app-minecraft rcon-cli kick <MinecraftUsername> "Reconnecting for server maintenance"

# Ban player username & IP
sudo podman exec app-minecraft rcon-cli ban <MinecraftUsername> "Griefing is forbidden"
sudo podman exec app-minecraft rcon-cli ban-ip <IPAddress>

# Unban player
sudo podman exec app-minecraft rcon-cli pardon <MinecraftUsername>
```

### 2.3 Gameplay Rules & World State
```bash
# Prevent inventory loss on death (friendly survival)
sudo podman exec app-minecraft rcon-cli gamerule keepInventory true

# Set time or weather
sudo podman exec app-minecraft rcon-cli time set day
sudo podman exec app-minecraft rcon-cli weather clear

# Broadcast colored announcement to all players
sudo podman exec app-minecraft rcon-cli say "§6[Server Announcement] §fDaily backup scheduled in 10 minutes."
```

---

## 3. Real-Time Performance Profiling with Spark

The server includes **Spark**, the industry standard profiling engine for Minecraft.

### 3.1 Understanding TPS & MSPT
Minecraft targets **20.0 TPS** (Ticks Per Second):
- **1 Tick = 50.0 milliseconds** (50 ms).
- **MSPT (Milliseconds Per Tick)**: The actual time the CPU takes to process one tick.
  - `MSPT < 40 ms` -> 🟢 **Flawless**: Server easily maintaining 20.0 TPS.
  - `40 ms < MSPT < 50 ms` -> 🟡 **Warning**: Server under heavy load, but still holding 20.0 TPS.
  - `MSPT > 50 ms` -> 🔴 **Lagging**: CPU cannot finish within 50 ms; TPS drops below 20.0 (block lag, rubber-banding).

```bash
# Check current TPS and average MSPT
sudo podman exec app-minecraft rcon-cli tps
sudo podman exec app-minecraft rcon-cli mspt
```

### 3.2 Running a 3-Minute Spark Performance Profile
When players report lag:

```bash
# Start a 3-minute profiler run
sudo podman exec app-minecraft rcon-cli spark profiler start --timeout 180
```

When the timer finishes, Spark uploads the profile and prints a URL:
```
[Spark] Profiler stopped! Results: https://spark.lucko.me/abc123xyz
```

Open the link in any browser to inspect:
1. **Thread Flamegraphs**: See exactly which function is consuming CPU time.
2. **Entity Tick Counts**: Identifies which chunks contain excessive animals, villagers, or items.
3. **Tile Entity Costs**: Pinpoints laggy redstone clocks, hoppers, or mob grinders.

---

## 4. Performance Tuning: Recommended Configurations

### 4.1 Recommended `server.properties`
Located in `/srv/apps/minecraft/data/server.properties`:

```properties
view-distance=8
simulation-distance=6
network-compression-threshold=256
max-chained-neighbor-updates=10000
sync-chunk-writes=false
enable-query=true
query.port=25565
enable-rcon=true
rcon.port=25575
```

### 4.2 Eliminating World Exploration Lag with Chunk Pre-Generation
Generating new terrain as players fly with Elytra or sprint on horses consumes heavy CPU.
Pre-generating a 5,000-block radius around spawn once completely eliminates this lag:

```bash
# Using the Chunky plugin in RCON:
sudo podman exec app-minecraft rcon-cli chunky radius 5000
sudo podman exec app-minecraft rcon-cli chunky start
```
*Run this overnight during maintenance; once generated, chunks load instantly from NVMe with zero CPU generation load.*
