export function computeBurnForSuccessRate({ observed, target }) {
  if (observed == null) return { burn: null, errorBudget: 1 - target, observedError: null };
  const errorBudget = 1 - target;
  const observedError = 1 - observed;
  const burn = burnRate({ observedError, errorBudget });
  return { burn, errorBudget, observedError };
}

export function computeBurnForMaxRate({ observedRate, targetMax }) {
  if (observedRate == null) return { burn: null, errorBudget: targetMax, observedError: null };
  const errorBudget = targetMax;
  const observedError = observedRate;
  const burn = burnRate({ observedError, errorBudget });
  return { burn, errorBudget, observedError };
}

export function burnRate({ observedError, errorBudget }) {
  if (errorBudget === 0) return observedError === 0 ? 0 : Number.POSITIVE_INFINITY;
  return observedError / errorBudget;
}

export function burnStatus({ burnShort, burnLong, thresholds }) {
  if (burnShort == null || burnLong == null) return 'UNKNOWN';
  const warn = thresholds?.warn ?? 1;
  const alertShort = thresholds?.alertShort ?? 2;
  const alertLong = thresholds?.alertLong ?? 1;

  if (burnShort >= alertShort && burnLong >= alertLong) return 'ALERT';
  if (burnShort >= warn || burnLong >= warn) return 'WARN';
  return 'OK';
}

export function worstStatus(statuses) {
  const order = { UNKNOWN: 0, OK: 1, WARN: 2, ALERT: 3 };
  let worst = 'UNKNOWN';
  for (const s of statuses) {
    const ss = s || 'UNKNOWN';
    if ((order[ss] ?? 0) > (order[worst] ?? 0)) worst = ss;
  }
  return worst;
}
