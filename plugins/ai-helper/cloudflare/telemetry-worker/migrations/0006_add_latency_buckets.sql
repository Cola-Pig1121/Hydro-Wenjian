-- Migration 0006: Latency histogram for percentiles
-- Stores the per-instance 24h latency bucket counts (JSON) so the dashboard can
-- merge them across instances and interpolate p50/p95/p99 — percentiles are not
-- averageable, but raw bucket counts sum cleanly.
-- Apply with: wrangler d1 migrations apply <db-name>

ALTER TABLE plugin_stats ADD COLUMN latency_buckets TEXT;
