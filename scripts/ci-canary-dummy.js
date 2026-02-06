#!/usr/bin/env node

// Deterministic dummy canary report for CI dogfooding.
// This is intentionally stable so PRs don't flap.

const fs = require('fs');

const report = {
  version: 1,
  summary: {
    score: 1.0,
    passed: true,
    note: 'Deterministic dummy report generated in CI',
  },
  scenarios: [
    { id: 'dummy/always-pass', passed: true, score: 1.0 },
    { id: 'dummy/format-check', passed: true, score: 1.0 },
  ],
};

fs.writeFileSync('eval-report.json', JSON.stringify(report, null, 2) + '\n');
console.log('Wrote eval-report.json');
