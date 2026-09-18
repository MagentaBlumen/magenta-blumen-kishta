# Scheduled jobs on the Hetzner box

Three systemd timers, all running as `deploy` from
`/opt/magenta-blumen/scripts/`. All units live in
`/opt/magenta-blumen/deploy/systemd/` (symlinked into
`/etc/systemd/system/`), so `git pull` updates them without re-copying.

| When (UTC)       | Timer                    | What                                   |
|------------------|--------------------------|----------------------------------------|
| Daily 03:15      | `generate-runs.timer`    | Extend delivery-run horizon, alert if it drops below 30d |
| Daily 03:30      | `backup.timer`           | `pg_dump` → Cloudflare R2, 180-day retention |
| Sunday 04:00     | `restore-check.timer`    | Restore latest backup into scratch DB and verify seed counts |

Ordering is deliberate:
- **03:15 generate-runs** runs BEFORE the backup so tonight's dump includes
  any newly-generated runs.
- **03:30 backup** runs 30 min after the unattended-upgrades auto-reboot
  window (03:00 UTC), so a kernel reboot never races the dump.
- **04:00 restore-check** (Sundays only) runs 30 min after Sunday's fresh
  backup, so it always verifies a dump that is at most a few hours old.

---

## Everyday operation

### See timer status

```bash
systemctl list-timers | grep -E 'backup|restore-check|generate-runs'
```

All three should show a `NEXT` timestamp in the near future.

### See the last run's output

```bash
journalctl -u generate-runs.service -n 100 --no-pager
journalctl -u backup.service         -n 100 --no-pager
journalctl -u restore-check.service  -n 100 --no-pager
```

### Force a run right now (test)

```bash
sudo systemctl start generate-runs.service
sudo systemctl start backup.service
sudo systemctl start restore-check.service
```

---

## First-time setup

Assumes deploy user, `/opt/magenta-blumen`, Docker, and `.env.production`
are in place (Session 2). See `docs/deploy.md`.

### 1. Install rclone (backups only)

```bash
sudo apt update && sudo apt install -y rclone
```

### 2. Symlink units and reload systemd

```bash
sudo ln -sf /opt/magenta-blumen/deploy/systemd/generate-runs.service /etc/systemd/system/generate-runs.service
sudo ln -sf /opt/magenta-blumen/deploy/systemd/generate-runs.timer   /etc/systemd/system/generate-runs.timer
sudo ln -sf /opt/magenta-blumen/deploy/systemd/backup.service        /etc/systemd/system/backup.service
sudo ln -sf /opt/magenta-blumen/deploy/systemd/backup.timer          /etc/systemd/system/backup.timer
sudo ln -sf /opt/magenta-blumen/deploy/systemd/restore-check.service /etc/systemd/system/restore-check.service
sudo ln -sf /opt/magenta-blumen/deploy/systemd/restore-check.timer   /etc/systemd/system/restore-check.timer
sudo systemctl daemon-reload
```

### 3. Test each service manually first

Never enable a timer without first proving the service works. Order:

```bash
sudo systemctl start generate-runs.service && journalctl -u generate-runs.service -n 30 --no-pager
sudo systemctl start backup.service        && journalctl -u backup.service        -n 30 --no-pager
sudo systemctl start restore-check.service && journalctl -u restore-check.service -n 40 --no-pager
```

Look for a `... done` (or `PASSED`) line at the end of each.

### 4. Enable the timers

Only after the manual runs pass:

```bash
sudo systemctl enable --now generate-runs.timer
sudo systemctl enable --now backup.timer
sudo systemctl enable --now restore-check.timer
systemctl list-timers | grep -E 'backup|restore-check|generate-runs'
```

---

## Known limits / TODO

- **Failure notification** is currently just `journalctl`. There is no
  paging / email / Sentry cron monitor yet. Check the three
  `journalctl -u <name>.service` outputs weekly. When Sentry Cron
  Monitors are wired, each of these should check-in on start + success.
- **Skipping a night** (box off, Hetzner outage) is fine for
  backup/restore-check (Persistent=true catches up on next boot) and
  irrelevant for generate-runs (idempotent; missing days get filled
  on the next successful run).
- **The generate-runs capacity is hardcoded 5**. When Sandra raises
  it in Einstellungen post-launch, edit `scripts/generate-runs.sql`
  and redeploy. Existing runs keep their original capacity — that's
  deliberate (existing bookings must not have the ground shift under
  them).

See also `docs/backups.md` for the destructive-restore procedure and
R2 credential notes.
