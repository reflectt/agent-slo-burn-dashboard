# DESIGN — Agent SLOs + Burn‑Rate Dashboard (thin-slice v1)

## 0) Summary
A **local-first**, file-based dashboard for OpenClaw health that answers, at a glance:
- Are runs healthy **right now**?
- Are we **burning error budget** too fast?
- Is the issue in **sessions**, **run-health alerts (stuck)**, or **canaries**?

v1 ships in 1 day:
- CLI is primary UI (`agent-slo refresh`, `agent-slo show`).
- Optional: generate a **static HTML report** for quick viewing.
- No external services; inputs are local files + `openclaw sessions --json`.

---

## 1) Information Architecture (what the UI shows)

### 1.1 CLI: `agent-slo show`
**Sections (in order):**
1. **Header**: overall status + window + last updated
2. **SLO Table** (3 rows): observed vs target + counts + burn rates (short/long) + status
3. **Error Budget / Burn Summary**: per-SLO burn interpretation (short/long) and budget remaining (derived)
4. **Top Failures** (best-effort):
   - Sessions: top `errorClass` / status reasons
   - Canaries: top failing `canary` names
   - Alerts: top `type` (optional)
5. **Data Health**: what inputs were present, file ages, parse errors/warnings

### 1.2 Optional HTML Report (static)
**Sections:**
1. **Hero / Status Strip** (overall)
2. **3 SLO Cards** (one per SLO)
3. **Burn-Rate Panel** (short vs long)
4. **Top Failures + Recent Events** (small lists)
5. **Data Sources / Footer** (paths + generatedAt)

---

## 2) Status semantics (OK/WARN/ALERT/UNKNOWN)

### 2.1 Burn-rate heuristic (v1)
Compute burn rate on two windows:
- **short** = 1h
- **long** = 6h

Burn math:
- For success-rate SLOs: `error_budget = 1 - target`, `observed_error = 1 - observed_success`, `burn = observed_error / error_budget`
- For “rate should be low” SLOs (stuck alert rate): `error_budget = targetMax`, `observed_error = observed_rate`, `burn = observed_error / error_budget`

Status thresholds:
- **OK** if `burn_short < 1` AND `burn_long < 1`
- **WARN** if `burn_short >= 1` OR `burn_long >= 1`
- **ALERT** if `burn_short >= 2` AND `burn_long >= 1`

Overall status = worst status across the 3 SLOs.

### 2.2 Color + text conventions
CLI (ANSI):
- **OK**: green
- **WARN**: yellow
- **ALERT**: red
- **UNKNOWN / DATA_MISSING**: gray

HTML:
- OK: `#16a34a` (green)
- WARN: `#f59e0b` (amber)
- ALERT: `#dc2626` (red)
- UNKNOWN: `#6b7280` (gray)

Always pair color with text tokens (`OK/WARN/ALERT/UNKNOWN`) to remain readable without color.

---

## 3) CLI UX (minimal commands)

### 3.1 Commands
- `agent-slo refresh`
  - Executes `openclaw sessions --json` → caches snapshot
  - Reads alerts ledger JSONL + canary history JSONL
  - Writes/updates today’s rollup JSON
  - Optionally writes `report/latest.json` and `report/latest.html`

- `agent-slo show [--window 1h|6h|24h] [--json]`
  - Reads latest rollup (or computes on-demand if absent; v1 can require rollup)
  - Prints compact summary (default window: 6h)

Nice-to-have (only if trivial):
- `agent-slo paths` (print resolved input paths)

### 3.2 CLI output mock (example)

```
Agent SLOs + Burn Dashboard   window=6h   updated=2026-02-05 13:00 PST
Overall: WARN   (worst=SLO3 canary_pass)

SLOs
- SLO1 session_success     99.5%  (target 99.0%)   n=217 ok=216 fail=1   burn 1h=0.5 6h=0.5   OK
- SLO2 stuck_alert_rate     0.2%  (max    0.5%)   n=217 stuck=0         burn 1h=0.0 6h=0.4   OK
- SLO3 canary_pass         95.0%  (target 98.0%)   n=20  pass=19 fail=1  burn 1h=0.0 6h=2.5   WARN

Error budget (interpretation)
- session_success:     burning below budget (short<1, long<1)
- stuck_alert_rate:    burning below budget (short<1, long<1)
- canary_pass:         over budget (long>=1) → investigate

Top failures (best-effort)
- Sessions: timeout=3, exception=1
- Canaries: login-flow=2
- Alerts: stuck=0, degraded=1

Data health
- sessions.latest.json: OK (age 7m)
- alerts.jsonl: OK (age 2m)
- canary-history.jsonl: OK (age 6m)
```

Behavioral notes:
- Always show **counts** (`n=`, `fail=`) alongside percentages.
- If a window has no events, show `observed=—` and status `UNKNOWN`.

---

## 4) Optional static HTML report (thin)

### 4.1 Generation
On `refresh`, generate:
- `data/report/latest.json` (same shape as rollup, plus resolved paths)
- `data/report/latest.html` (single self-contained file; inline CSS)

No JS required in v1.

### 4.2 Wireframe (text)

```
+--------------------------------------------------------------+
| Agent SLOs + Burn Dashboard           updated: 2026-02-05 ... |
| OVERALL: WARN   window: 6h   short: 1h long: 6h               |
+--------------------------------------------------------------+

+--------------------+  +--------------------+  +--------------------+
| SLO1 Sessions       |  | SLO2 Stuck Alerts  |  | SLO3 Canaries      |
| OK                  |  | OK                 |  | WARN               |
| 99.5% / 99.0%       |  | 0.2% / ≤0.5%       |  | 95.0% / 98.0%      |
| burn 1h 0.5 6h 0.5  |  | burn 1h 0.0 6h 0.4 |  | burn 1h 0.0 6h 2.5 |
| n=217 fail=1        |  | n=217 stuck=0      |  | n=20 fail=1        |
+--------------------+  +--------------------+  +--------------------+

+----------------------- Burn Summary --------------------------+
| OK: below budget (short<1 & long<1)                            |
| WARN: over budget on either window                             |
| ALERT: sustained high burn (short>=2 & long>=1)                |
+---------------------------------------------------------------+

+----------------------- Top Failures ---------------------------+
| Sessions: timeout(3), exception(1)                              |
| Canaries: login-flow(2)                                         |
| Alerts: degraded(1)                                             |
+---------------------------------------------------------------+

+----------------------- Data Sources ---------------------------+
| sessions: data/inputs/sessions.latest.json  age: 7m            |
| alerts:   ~/.openclaw/run-health/alerts.jsonl  age: 2m         |
| canary:   ~/.openclaw/canary/history.jsonl     age: 6m         |
+---------------------------------------------------------------+
```

---

## 5) Data flow & outputs (what gets generated)

### 5.1 Inputs (read)
- `openclaw sessions --json` output (cached): `data/inputs/sessions.latest.json`
- Alerts ledger (JSONL): configurable path (default `~/.openclaw/run-health/alerts.jsonl`)
- Canary history (JSONL): configurable path (default `~/.openclaw/canary/history.jsonl`)

### 5.2 Derived artifacts (write)
- Daily rollup: `data/rollups/YYYY-MM-DD.json`
- Convenience pointer (optional): `data/rollups/latest.json` (copy/symlink)
- Optional report:
  - `data/report/latest.json`
  - `data/report/latest.html`

### 5.3 Developer-facing files to create (repo)
Minimal set for a 1-day build:
- `bin/agent-slo` (node entrypoint)
- `src/cli.mjs` (arg parsing + command dispatch)
- `src/config.mjs` (load default config + env overrides)
- `src/adapters/openclawSessions.mjs` (schema mapper)
- `src/adapters/alertsLedger.mjs` (JSONL parser + type mapping)
- `src/adapters/canaryHistory.mjs` (JSONL parser + status mapping)
- `src/core/windows.mjs` (parse durations, compute [from,to])
- `src/core/slo.mjs` (compute observed rates + counts)
- `src/core/burn.mjs` (burn math + status)
- `src/render/cli.mjs` (ANSI table output)
- `src/render/html.mjs` (tiny static template)
- `config/default.json`
- `fixtures/` (small sample data)
- `scripts/validate.mjs` (fixture assertions; can be node-only)

---

## 6) Edge cases & required behaviors

### 6.1 No data yet (empty windows)
- If **no events** in a window:
  - observed rate = `null`
  - burn rate = `null`
  - status = `UNKNOWN`
  - CLI prints `—` for observed and burn; always show `n=0`

### 6.2 Missing input files
- Missing sessions cache: show sessions SLO as `DATA_MISSING` (or `UNKNOWN`) and continue.
- Missing alerts ledger: stuck SLO becomes `DATA_MISSING` and continue.
- Missing canary history: canary SLO becomes `DATA_MISSING` and continue.
- Overall status should be computed only from available SLOs; if all missing → overall `UNKNOWN`.

### 6.3 Partial / unparseable lines in JSONL
- Skip invalid lines, count them, and surface in **Data health** (e.g., `alerts.jsonl: WARN (3 parse errors)`).
- Do not fail the whole run.

### 6.4 Extremely small denominators
- If `n < 20` (configurable), append `LOW_N` note in CLI/Data health.
- Still compute rates, but emphasize counts.

### 6.5 Target edge cases
- If target implies **zero error budget** (e.g., target=1.0 or targetMax=0):
  - If observed error is 0 → burn `0`
  - Else burn `Infinity` and status `ALERT`

### 6.6 Time semantics
- v1 window membership:
  - Sessions counted by `tsStart` within `[from,to]`.
  - Alerts and canaries counted by their `ts`.
- Display timestamps in local timezone; store ISO8601 in outputs.

---

## 7) Thin-slice acceptance checklist (v1)
- `agent-slo refresh` produces deterministic rollup JSON for given inputs.
- `agent-slo show --window 6h` prints:
  - overall + 3 SLO lines with values, targets, burn (1h/6h), and status
  - top failures lists (best-effort)
  - last updated + data health
- Handles missing/empty/partial data without crashing.
- Optional HTML report renders same high-level signals (overall + 3 SLO cards).
