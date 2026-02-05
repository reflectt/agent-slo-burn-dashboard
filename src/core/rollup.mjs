import { computeWindows } from './windows.mjs';
import { computeBurnForSuccessRate, computeBurnForMaxRate, burnStatus, worstStatus } from './burn.mjs';
import { computeSessionSuccess, computeAlertRates, computeCanaryPass, topCounts } from './slo.mjs';

export function computeRollup({ now, cfg, sessions, alerts, canaries, dataHealth }) {
  const winSpecs = cfg.windows?.report || ['1h', '6h', '24h'];
  const windows = computeWindows({ now, windowSpecs: winSpecs });

  const sessTarget = cfg.slos.session_success.target;
  const stuckTargetMax = cfg.slos.stuck_alert_rate.targetMax;
  const canaryTarget = cfg.slos.canary_pass.target;

  const observedSessions = {};
  const observedStuck = {};
  const observedCanary = {};

  const sessCounts = {};
  const stuckCounts = {};
  const canaryCounts = {};

  for (const w of winSpecs) {
    const win = windows[w];

    const s = computeSessionSuccess({ sessions, win });
    observedSessions[w] = s.observed;
    sessCounts[w] = { n: s.n, ok: s.ok, fail: s.fail, unknown: s.unknown };

    const a = computeAlertRates({ sessions, alerts, win });
    observedStuck[w] = a.observedRate;
    stuckCounts[w] = { denom: a.denom, nSessions: a.nSessions, stuck: a.stuck, nAlerts: a.items.length };

    const c = computeCanaryPass({ canaries, win });
    observedCanary[w] = c.observed;
    canaryCounts[w] = { n: c.n, pass: c.pass, fail: c.fail, unknown: c.unknown };
  }

  const short = cfg.windows?.short || '1h';
  const long = cfg.windows?.long || '6h';

  const sessBurnShort = computeBurnForSuccessRate({ observed: observedSessions[short], target: sessTarget }).burn;
  const sessBurnLong = computeBurnForSuccessRate({ observed: observedSessions[long], target: sessTarget }).burn;
  const sessStatus = burnStatus({ burnShort: sessBurnShort, burnLong: sessBurnLong, thresholds: cfg.burn });

  const stuckBurnShort = computeBurnForMaxRate({ observedRate: observedStuck[short], targetMax: stuckTargetMax }).burn;
  const stuckBurnLong = computeBurnForMaxRate({ observedRate: observedStuck[long], targetMax: stuckTargetMax }).burn;
  const stuckStatus = burnStatus({ burnShort: stuckBurnShort, burnLong: stuckBurnLong, thresholds: cfg.burn });

  const canaryBurnShort = computeBurnForSuccessRate({ observed: observedCanary[short], target: canaryTarget }).burn;
  const canaryBurnLong = computeBurnForSuccessRate({ observed: observedCanary[long], target: canaryTarget }).burn;
  const canaryStatus = burnStatus({ burnShort: canaryBurnShort, burnLong: canaryBurnLong, thresholds: cfg.burn });

  const slos = {
    session_success: {
      target: sessTarget,
      observed: observedSessions,
      counts: sessCounts,
      burnRate: { [short]: sessBurnShort, [long]: sessBurnLong },
      status: sessStatus
    },
    stuck_alert_rate: {
      targetMax: stuckTargetMax,
      observed: observedStuck,
      counts: stuckCounts,
      burnRate: { [short]: stuckBurnShort, [long]: stuckBurnLong },
      status: stuckStatus
    },
    canary_pass: {
      target: canaryTarget,
      observed: observedCanary,
      counts: canaryCounts,
      burnRate: { [short]: canaryBurnShort, [long]: canaryBurnLong },
      status: canaryStatus
    }
  };

  // Best-effort top failures (use 24h window for lists).
  const sess24 = sessions.filter((s) => {
    const win = windows['24h'] || windows[winSpecs.at(-1)];
    return win ? (new Date(s.tsStart) >= new Date(win.from) && new Date(s.tsStart) <= new Date(win.to)) : true;
  });
  const can24 = canaries.filter((c) => {
    const win = windows['24h'] || windows[winSpecs.at(-1)];
    return win ? (new Date(c.ts) >= new Date(win.from) && new Date(c.ts) <= new Date(win.to)) : true;
  });

  const topFailures = {
    sessions: topCounts(sess24.filter((s) => s.status === 'fail'), (s) => s.errorClass || 'unknown', 5),
    canaries: topCounts(can24.filter((c) => c.status === 'fail'), (c) => c.canary || 'unknown', 5),
    alerts: topCounts(alerts, (a) => a.type || 'unknown', 5)
  };

  const overallStatus = worstStatus([sessStatus, stuckStatus, canaryStatus].filter(Boolean));

  return {
    generatedAt: now.toISOString(),
    windows,
    slos,
    overall: { status: overallStatus },
    topFailures,
    dataHealth: dataHealth || {}
  };
}
