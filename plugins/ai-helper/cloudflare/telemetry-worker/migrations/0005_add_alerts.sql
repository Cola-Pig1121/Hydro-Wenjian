-- Migration 0005: Proactive alerting
-- The dashboard was pull-only; this table records alerts raised by the cron
-- evaluator. It doubles as the dedup ledger (same alert_key within a cooldown
-- is not re-raised) and as the dashboard's alert history.
-- Apply with: wrangler d1 migrations apply <db-name>

CREATE TABLE IF NOT EXISTS plugin_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_key ON plugin_alerts(alert_key);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON plugin_alerts(created_at);
