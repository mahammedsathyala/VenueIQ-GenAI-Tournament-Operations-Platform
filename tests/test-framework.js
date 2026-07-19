/* ══════════════════════════════════════════════════════════════════════
   VenueIQ — Shared Test Framework
   Provides: describe(), it(), expect(), runTests(), TEST_RESULTS
   ════════════════════════════════════════════════════════════════════ */

'use strict';

// Allow multiple files to share the same TEST_RESULTS array
if (typeof window.TEST_RESULTS === 'undefined') window.TEST_RESULTS = [];
if (typeof window._currentSuite === 'undefined') window._currentSuite = '';

function describe(label, fn) {
  window._currentSuite = label;
  try { fn(); } catch (e) {
    window.TEST_RESULTS.push({ suite: label, name: 'Suite Error', pass: false, error: e.message });
  }
}

function it(name, fn) {
  try {
    fn();
    window.TEST_RESULTS.push({ suite: window._currentSuite, name, pass: true });
  } catch (e) {
    window.TEST_RESULTS.push({ suite: window._currentSuite, name, pass: false, error: e.message });
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toEqual(expected) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toBeTruthy() { if (!value) throw new Error(`Expected truthy, got ${JSON.stringify(value)}`); },
    toBeFalsy()  { if (value)  throw new Error(`Expected falsy, got ${JSON.stringify(value)}`); },
    toBeNull()   { if (value !== null) throw new Error(`Expected null, got ${JSON.stringify(value)}`); },
    toBeUndefined() { if (typeof value !== 'undefined') throw new Error(`Expected undefined`); },
    toBeGreaterThan(n)        { if (!(value > n))  throw new Error(`Expected ${value} > ${n}`); },
    toBeLessThan(n)           { if (!(value < n))  throw new Error(`Expected ${value} < ${n}`); },
    toBeGreaterThanOrEqual(n) { if (!(value >= n)) throw new Error(`Expected ${value} >= ${n}`); },
    toBeLessThanOrEqual(n)    { if (!(value <= n)) throw new Error(`Expected ${value} <= ${n}`); },
    toContain(substr) {
      if (typeof value === 'string' && !value.includes(substr))
        throw new Error(`Expected "${value}" to contain "${substr}"`);
      if (Array.isArray(value) && !value.includes(substr))
        throw new Error(`Expected array to contain ${JSON.stringify(substr)}`);
    },
    toBeInstanceOf(cls) {
      if (!(value instanceof cls)) throw new Error(`Expected instance of ${cls.name}`);
    },
    toHaveLength(n) {
      if (value.length !== n) throw new Error(`Expected length ${n}, got ${value.length}`);
    },
    toMatch(regex) {
      if (!regex.test(value)) throw new Error(`Expected "${value}" to match ${regex}`);
    },
    not: {
      toBe(expected)       { if (value === expected)    throw new Error(`Expected NOT ${JSON.stringify(expected)}`); },
      toContain(substr)    { if (value.includes(substr)) throw new Error(`Expected NOT to contain "${substr}"`); },
      toBeTruthy()         { if (value)  throw new Error(`Expected falsy`); },
      toBeFalsy()          { if (!value) throw new Error(`Expected truthy`); },
      toBeNull()           { if (value === null) throw new Error(`Expected not null`); },
      toBeUndefined()      { if (typeof value === 'undefined') throw new Error(`Expected not undefined`); },
    }
  };
}

function runTests() {
  const container = document.getElementById('test-results');
  if (!container) return;
  const results = window.TEST_RESULTS;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total  = results.length;
  const pct    = total ? Math.round(passed / total * 100) : 0;

  // Group by suite
  const suites = {};
  results.forEach(r => {
    if (!suites[r.suite]) suites[r.suite] = [];
    suites[r.suite].push(r);
  });

  const suiteKeys = Object.keys(suites);
  let html = `
    <div class="test-summary ${failed === 0 ? 'all-pass' : 'has-fail'}">
      <div class="ts-score">${passed}/${total}</div>
      <div class="ts-label">Tests Passing</div>
      <div class="ts-stats">
        <span class="ts-pass">✅ ${passed} passed</span>
        <span class="ts-fail">❌ ${failed} failed</span>
        <span style="color:var(--muted)">📋 ${suiteKeys.length} suites</span>
      </div>
      <div class="ts-bar"><div class="ts-bar-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="suite-grid">
  `;

  suiteKeys.forEach(suite => {
    const tests = suites[suite];
    const sp = tests.filter(t => t.pass).length;
    const icon = sp === tests.length ? '✅' : sp === 0 ? '❌' : '⚠️';
    html += `
      <div class="suite-block">
        <div class="suite-header">${icon} ${suite} <span class="suite-count">${sp}/${tests.length}</span></div>
        <div class="suite-tests">
          ${tests.map(t => `
            <div class="test-row ${t.pass ? 'pass' : 'fail'}">
              <span class="test-icon">${t.pass ? '✓' : '✗'}</span>
              <span class="test-name">${t.name}</span>
              ${!t.pass ? `<div class="test-err">${t.error}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  const scoreEl = document.getElementById('test-score');
  if (scoreEl) scoreEl.textContent = `${pct}% passing`;
  const countEl = document.getElementById('test-count');
  if (countEl) countEl.textContent = `${total} tests · ${suiteKeys.length} suites`;
}
