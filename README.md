# agent-slo-burn-dashboard (thin-slice v1)

Local-first CLI dashboard that computes 3 SLOs (sessions, stuck alerts, canaries) and a simple 1h/6h burn-rate heuristic.

## Layout

- Inputs cached to: `var/raw/`
- Daily rollups: `var/rollups/YYYY-MM-DD.json` (+ `var/rollups/latest.json`)
- Optional report: `var/reports/latest.html`

## Commands

### Refresh (collect + rollup)

```bash
cd projects/agent-slo-burn-dashboard
npm run refresh -- --html
# or
./bin/agent-slo refresh --html
```

This will run:
- `openclaw sessions --json --active <minutes>` (defaults to 1440)
- copy alerts + canary JSONL sources into `var/raw/`

### Show (human summary)

```bash
./bin/agent-slo show --window 6h
./bin/agent-slo show --window 6h --json
```

## Config

Defaults in `config/default.json`.

Env overrides:
- `AGENT_SLO_ALERTS_PATH`
- `AGENT_SLO_CANARY_PATH`
- `AGENT_SLO_SESSIONS_ACTIVE_MINUTES`

## Selftest

```bash
npm run selftest
```
