---
title: "Automated Off-Box Backups & Disaster Recovery"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-06
owner: harshil
related_docs: [./README.md, ./02-PODMAN-QUADLET-SETUP.md, ./06-ADMINISTRATION-AND-TUNING.md, ../security/AUDIT-PIPELINE.md]
tags: [minecraft, backups, disaster-recovery, r2, age, zstd, encryption]
---

# 05. Automated Off-Box Backups & Disaster Recovery

> **TL;DR (non-technical):** Player creations represent hundreds of hours of creative effort.
> This document details how the server automatically flushes world changes to disk, compresses them into
> tiny archives, encrypts them, and sends a copy off the server to Cloudflare R2 storage every night
> without kicking players or causing game lag.

---

## 1. The Zero-Downtime Backup Strategy

Traditional Minecraft backups either shut down the server or risk archiving corrupt chunk files when saving
chunks mid-write. Our backup pipeline uses **RCON atomic flushing**:

```
[Systemd Timer: 04:30 UTC]
           │
           ▼
[rcon-cli save-off] ────────> Freezes automated chunk writes to disk
           │
           ▼
[rcon-cli save-all flush] ──> Forces all pending chunk modifications to sync to NVMe
           │
           ▼
[tar --zstd compression] ───> Archives /srv/apps/minecraft/data (takes ~15 seconds)
           │
           ▼
[rcon-cli save-on] ─────────> Unfreezes chunk saving; server continues without interruption
           │
           ▼
[age public key encryption] ─> Encrypts archive (private key is NOT on the server)
           │
           ▼
[Cloudflare R2 Bucket Sync] ─> Uploads to backups/minecraft/ with 30-day object lock
```

---

## 2. The Backup Script (`/opt/vps/bin/vps-minecraft-backup`)

Install the following bash script on `krown`:

```bash
#!/usr/bin/env bash
# /opt/vps/bin/vps-minecraft-backup
# Managed by cf-vps. Automated Minecraft world snapshot & off-box R2 sync.
set -euo pipefail

CONTAINER="app-minecraft"
BACKUP_DIR="/srv/apps/minecraft/backups"
DATA_DIR="/srv/apps/minecraft/data"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
ARCHIVE="${BACKUP_DIR}/minecraft-${TIMESTAMP}.tar.zst"
OUTBOX="/srv/audit/outbox/backups/minecraft"

echo "=== [${TIMESTAMP}] Starting Minecraft world backup ==="

# 1. Verify container is running
if ! podman ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Container ${CONTAINER} is not running. Aborting backup." >&2
  exit 1
fi

# 2. Tell Minecraft to flush all chunks to disk and disable auto-save
echo "Flushing world chunks via RCON..."
podman exec "${CONTAINER}" rcon-cli save-off
podman exec "${CONTAINER}" rcon-cli save-all flush

# 3. Compress world directories with Zstandard
echo "Creating zstd archive: ${ARCHIVE}..."
tar --zstd -cf "${ARCHIVE}" \
  -C "${DATA_DIR}" \
  world world_nether world_the_end server.properties

# 4. Re-enable automated world saving
podman exec "${CONTAINER}" rcon-cli save-on
echo "Auto-save re-enabled. Archive size: $(du -h "${ARCHIVE}" | cut -f1)"

# 5. Encrypt with platform age key and stage for R2 upload
if [[ -f "/etc/vps/backup-key.pub" ]]; then
  AGE_KEY=$(cat /etc/vps/backup-key.pub)
  ENCRYPTED="${ARCHIVE}.age"
  mkdir -p "${OUTBOX}"
  
  echo "Encrypting backup with platform age recipient..."
  age -r "${AGE_KEY}" -o "${ENCRYPTED}" "${ARCHIVE}"
  
  # Stage to Vector / R2 upload directory
  mv "${ENCRYPTED}" "${OUTBOX}/"
  echo "Staged to R2 outbox: ${OUTBOX}/"
fi

# 6. Retention: Prune local archives older than 7 days
echo "Pruning local archives older than 7 days..."
find "${BACKUP_DIR}" -name "minecraft-*.tar.zst" -mtime +7 -delete

echo "=== [$(date -u +"%Y%m%dT%H%M%SZ")] Backup completed successfully ==="
```

Make the script executable:
```bash
sudo chmod 750 /opt/vps/bin/vps-minecraft-backup
```

---

## 3. Automated Systemd Timer Configuration

### 3.1 Service Unit (`/etc/systemd/system/vps-minecraft-backup.service`)
```ini
[Unit]
Description=Minecraft Daily World Backup & R2 Sync
After=app-minecraft.service

[Service]
Type=oneshot
ExecStart=/opt/vps/bin/vps-minecraft-backup
Slice=app.slice
User=root
```

### 3.2 Timer Unit (`/etc/systemd/system/vps-minecraft-backup.timer`)
```ini
[Unit]
Description=Nightly Minecraft Backup Schedule

[Timer]
# Runs daily at 04:30:00 UTC (off-peak hours)
OnCalendar=*-*-* 04:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vps-minecraft-backup.timer
```

---

## 4. Point-in-Time Disaster Recovery Runbooks

### 4.1 Scenario A: Restoring from Local Disk (Griefing or World Corruption)
If a player accidentally destroys an area or chunk files become corrupted:

1. **Stop the Minecraft server**:
   ```bash
   sudo systemctl stop app-minecraft.service
   ```
2. **Move current damaged world aside**:
   ```bash
   sudo mv /srv/apps/minecraft/data/world /srv/apps/minecraft/data/world.damaged.$(date +%s)
   ```
3. **Select and extract the backup**:
   ```bash
   # List local snapshots
   ls -lh /srv/apps/minecraft/backups/
   
   # Extract the chosen snapshot
   sudo tar --zstd -xvf /srv/apps/minecraft/backups/minecraft-20261005T043000Z.tar.zst \
     -C /srv/apps/minecraft/data/
   ```
4. **Fix user namespace permissions**:
   ```bash
   sudo chown -R 100000:100000 /srv/apps/minecraft/data
   ```
5. **Restart server**:
   ```bash
   sudo systemctl start app-minecraft.service
   ```

---

### 4.2 Scenario B: Bare-Metal Restore from Remote R2 (Server Lost or Rebuilt)
If the server hardware was destroyed, rebuilt, or reprovisioned:

1. **Download encrypted snapshot from R2**:
   ```bash
   rclone copy r2:madagascar-audit/backups/minecraft/minecraft-latest.tar.zst.age /tmp/
   ```
2. **Decrypt using the platform's private recovery age key**:
   ```bash
   age -d -i ~/.config/age/recovery.key /tmp/minecraft-latest.tar.zst.age > /tmp/world.tar.zst
   ```
3. **Extract into data folder**:
   ```bash
   sudo mkdir -p /srv/apps/minecraft/data
   sudo tar --zstd -xvf /tmp/world.tar.zst -C /srv/apps/minecraft/data/
   sudo chown -R 100000:100000 /srv/apps/minecraft/data
   ```
4. **Start service**:
   ```bash
   sudo systemctl enable --now app-minecraft.service
   ```

---

## 5. Next Steps

Proceed to [`06-ADMINISTRATION-AND-TUNING.md`](./06-ADMINISTRATION-AND-TUNING.md) for in-game administration,
RCON cheatsheets, Spark performance profiling, and lag troubleshooting.
