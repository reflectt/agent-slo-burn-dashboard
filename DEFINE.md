# DEFINE — Agent SLOs + Burn‑Rate Dashboard (thin-slice v1)

## 0) Goal
Ship a local‑first, file‑based dashboard (CLI first) that answers, **at a glance**, whether OpenClaw agent runs are healthy *and* whether we’re burning error budget too fast.

This v1 must be **shippable in 1 day** using only **inputs we can measure now**:
- `openclaw sessions --json` (session outcomes + durations)
- **run‑health alerts ledger** (stuck / degraded / incident-style alerts)
- **scheduled canary history** (JSONL)

Non‑goals (v1):
- No hosted services, no DB, no Grafana.
- No real-time streaming; batch refresh is fine.
- No complex SLO math or multi-window multi-burn; keep a single simple heuristic.

## 1) Users / Decisions
**Primary user:** the operator/dev running OpenClaw locally.

Decisions this should enable:
1. “Are we healthy right now?” (last 1–24h)
2. “Are we trending unhealthy?” (burn‑rate heuristic)
3. “What’s failing: sessions, monitors, or canaries?”

## 2) Success Criteria (Definition of Done)
- `./bin/agent-slo` (or `node ./src/cli.mjs`) reads the three inputs and writes a daily rollup JSON.
- CLI prints:
  - 3 SLOs (status + current value + target)
  - error budget remaining (by window)
  - simple burn indicator (OK/WARN/ALERT)
  - top failure reasons (best-effort)
- Produces deterministic output for a given input set.
- Includes a validation script + sample fixture data.

## 3) SLOs (max 3)
All SLOs are computed over rolling windows: **1h**, **6h**, **24h** (configurable), but only one burn-rate heuristic is required.

### SLO #1 — Session Success Rate
**What it measures:** the fraction of agent sessions that complete successfully.

- **Source:** `openclaw sessions --json`
- **Indicator:** `successful_sessions / total_sessions`
- **Target:** 99% (default; configurable)
- **Good:** high success rate indicates baseline agent reliability.

**Notes / assumptions:**
- Define success as `status in {"success","completed"}` (final mapping depends on actual schema; see §6).
- Exclude sessions with missing final status (optional).

### SLO #2 — Stuck Alert Rate
**What it measures:** the fraction of sessions that trigger a “stuck / hung / no-progress” alert.

- **Source:** run‑health alerts ledger
- **Indicator:** `stuck_alerts / total_sessions`
- **Target:** ≤ 0.5% (default; configurable)
- **Good:** ensures we catch “agent got stuck” regressions that aren’t visible in success rate alone.

**Notes / assumptions:**
- The ledger must include a `type` or `category` we can map to `stuck`.
- If the ledger is independent of sessions, compute per time window rather than per-session.

### SLO #3 — Canary Pass Rate
**What it measures:** the fraction of scheduled canary checks that pass.

- **Source:** scheduled canary history JSONL
- **Indicator:** `passed_canaries / total_canaries`
- **Target:** 98% (default; configurable)
- **Good:** catches silent regressions in critical flows.

**Regression signal (secondary):** also compute `new_failures` vs previous day/hour, but keep it informational in v1.

## 4) Simple Burn‑Rate Heuristic (v1)
We need something simple, local, and understandable.

### Error budget
For each SLO, define:
- `target` (e.g., 0.99)
- `error_budget = 1 - target`
- `observed_error_rate = 1 - observed_success_rate`
- **burn_rate = observed_error_rate / error_budget**

For “rate should be low” SLOs (stuck alert rate): treat it as:
- `observed_error_rate = observed_rate`
- `error_budget = target_max_rate`

### Burn status
Compute burn rate on 2 windows: **short = 1h**, **long = 6h**.

- **OK** if `burn_rate_short < 1` AND `burn_rate_long < 1`
- **WARN** if `burn_rate_short >= 1` OR `burn_rate_long >= 1`
- **ALERT** if `burn_rate_short >= 2` AND `burn_rate_long >= 1`

Rationale: if we’re burning faster than budget, we’re on track to miss SLO; “ALERT” requires sustained burn.

### Overall health
Overall status is the worst across the three SLOs.

## 5) Inputs (what we read)
### 5.1 `openclaw sessions --json`
We will treat the output as an array of session records. We only require:
- `id` (string)
- `startedAt` (timestamp)
- `endedAt` (timestamp, optional)
- `status` (string)
- optional: `error` / `exitCode` / `summary`

If schema differs, adapt via a mapper in `src/adapters/openclawSessions.mjs`.

### 5.2 Run‑health alerts ledger
Assume an append‑only JSONL file with one record per alert event.

Required fields (minimum):
- `ts` (timestamp)
- `type` (e.g., `stuck`, `degraded`, `error`, etc.)
- `severity` (optional)
- `sessionId` (optional)
- `message` (optional)

File path is configurable; default to something like:
- `~/.openclaw/run-health/alerts.jsonl` (or project‑local path)

### 5.3 Scheduled canary history JSONL
Assume JSONL with one record per canary run.

Required fields (minimum):
- `ts` (timestamp)
- `canaryId` or `name`
- `status` in `{pass,fail}` (or mappable)
- `durationMs` (optional)
- `details` (optional)

## 6) Data Model (normalized)
All inputs are normalized to three internal event streams:

### 6.1 SessionEvent (normalized)
```json
{
  "tsStart": "2026-02-05T20:10:00Z",
  "tsEnd": "2026-02-05T20:12:40Z",
  "sessionId": "sess_...",
  "status": "success|fail|unknown",
  "durationMs": 160000,
  "errorClass": "timeout|exception|tooling|unknown",
  "raw": {}
}
```

### 6.2 AlertEvent (normalized)
```json
{
  "ts": "2026-02-05T20:11:10Z",
  "type": "stuck|degraded|error|unknown",
  "severity": "info|warn|error|critical",
  "sessionId": "sess_...",
  "raw": {}
}
```

### 6.3 CanaryEvent (normalized)
```json
{
  "ts": "2026-02-05T20:00:00Z",
  "canary": "login-flow",
  "status": "pass|fail|unknown",
  "durationMs": 12345,
  "raw": {}
}
```

### 6.4 Rollup (output)
One JSON file per day (local-first):
```json
{
  "generatedAt": "2026-02-05T21:00:00Z",
  "windows": {
    "1h": { "from": "...", "to": "..." },
    "6h": { "from": "...", "to": "..." },
    "24h": { "from": "...", "to": "..." }
  },
  "slos": {
    "session_success": {
      "target": 0.99,
      "observed": { "1h": 0.97, "6h": 0.995, "24h": 0.992 },
      "burnRate": { "1h": 3.0, "6h": 0.5 },
      "status": "WARN"
    },
    "stuck_alert_rate": {
      "targetMax": 0.005,
      "observed": { "1h": 0.01, "6h": 0.002, "24h": 0.003 },
      "burnRate": { "1h": 2.0, "6h": 0.4 },
      "status": "WARN"
    },
    "canary_pass": {
      "target": 0.98,
      "observed": { "1h": 1.0, "6h": 0.95, "24h": 0.985 },
      "burnRate": { "1h": 0.0, "6h": 2.5 },
      "status": "WARN"
    }
  },
  "overall": { "status": "WARN" },
  "topFailures": {
    "sessions": [{ "key": "timeout", "count": 3 }],
    "canaries": [{ "key": "login-flow", "count": 2 }]
  }
}
```

## 7) Collection Cadence
v1 is batch-only.

- **Recommended:** run every 15 minutes via `cron`/LaunchAgent (out of scope to install).
- **Minimum:** on-demand `agent-slo refresh`.

Suggested default windows use “now” as end time:
- 1h, 6h, 24h

## 8) Storage (file-based, local-first)
Project-local layout:
```
projects/agent-slo-burn-dashboard/
  data/
    inputs/
      sessions.latest.json            # cached output from openclaw sessions --json
      alerts.jsonl                    # symlink or copied ledger (optional)
      canary-history.jsonl            # symlink or copied source
    rollups/
      2026-02-05.json                 # daily rollup
  src/
  bin/
```

Principles:
- Inputs are never mutated; rollups are derived.
- Prefer JSONL for append-only event streams; JSON for snapshots/rollups.

## 9) Minimal UI / CLI Output
CLI commands (v1):

### `agent-slo refresh`
- Pull latest sessions snapshot: run `openclaw sessions --json` and save to `data/inputs/sessions.latest.json`.
- Read alerts ledger + canary JSONL.
- Produce rollup JSON for today (`data/rollups/YYYY-MM-DD.json`).

### `agent-slo show [--window 1h|6h|24h]`
Print a compact text summary:

Example:
```
Overall: WARN (window: 6h)

SLO 1 Session success      99.5% (target 99.0%)  burn 0.5  OK
SLO 2 Stuck alert rate      0.2% (max 0.5%)      burn 0.4  OK
SLO 3 Canary pass          95.0% (target 98.0%)  burn 2.5  WARN

Top session failures: timeout=3, exception=1
Top failing canaries: login-flow=2
Last updated: 2026-02-05 13:00 PST
```

Optional flags:
- `--json` output for scripting
- `--since` / `--until` (nice-to-have)

## 10) Computation Details (v1)
- Timestamp parsing: ISO8601; assume local timezone only for display.
- Window filtering: include events whose timestamp falls within `[from, to]`.
- Session success rate uses sessions whose `tsStart` is within window (or `tsEnd` if available); pick one and document. v1: **use `tsStart`** for simplicity.
- Deduplication: if duplicates exist in JSONL, accept them in v1 (document). Optionally dedupe by `(sessionId,type,ts)` for alerts.

## 11) Configuration
A single config file in repo (committed): `config/default.json`
```json
{
  "paths": {
    "alertsLedger": "~/.openclaw/run-health/alerts.jsonl",
    "canaryHistory": "~/.openclaw/canary/history.jsonl"
  },
  "windows": { "short": "1h", "long": "6h", "report": ["1h","6h","24h"] },
  "slos": {
    "session_success": { "target": 0.99 },
    "stuck_alert_rate": { "targetMax": 0.005 },
    "canary_pass": { "target": 0.98 }
  },
  "burn": { "warn": 1, "alertShort": 2, "alertLong": 1 }
}
```
Allow env overrides (nice-to-have): `AGENT_SLO_ALERTS_PATH`, etc.

## 12) Validation Plan
### 12.1 Fixture-based tests (fast)
Create small fixture files:
- `fixtures/sessions.successy.json`
- `fixtures/alerts.stuck.jsonl`
- `fixtures/canary.mixed.jsonl`

Assertions:
- Correct counts per window.
- Burn-rate math (including division by zero when error budget is 0).
- Status mapping and unknown handling.

### 12.2 Smoke test (real data)
Manual steps:
1. Run `openclaw sessions --json > data/inputs/sessions.latest.json`.
2. Point config to actual ledger + canary history paths.
3. Run `agent-slo refresh`.
4. Confirm:
   - rollup file created
   - `agent-slo show` matches expectations

### 12.3 Backfill sanity
Run refresh with `--until` (optional) for yesterday using copied inputs to ensure rollups are stable.

## 13) Edge Cases / Safeguards
- Missing files: show “DATA_MISSING” status per SLO and do not crash.
- No events in window: observed is `null` and status is `UNKNOWN` (or treat as 100% pass for canaries only if that’s desired; v1: **UNKNOWN**).
- Extremely small denominators: display counts alongside percentages.

## 14) 1‑Day Implementation Plan
1. **Adapters**
   - Parse sessions JSON; map statuses.
   - Parse alerts JSONL; map stuck types.
   - Parse canary JSONL; map pass/fail.
2. **Core math**
   - window slicing
   - SLO computation
   - burn computation + status
3. **CLI**
   - `refresh` + `show`
4. **Fixtures + validation**
   - add sample inputs
   - run a smoke test

## 15) Open Questions (to resolve quickly)
- Exact schema of `openclaw sessions --json` fields (`status` values, timestamps).
- Exact location + schema of run‑health ledger.
- Canary JSONL field names (`status` vs `ok`, etc.).

(Resolve by inspecting 1 real sample of each input; then finalize adapters.)
