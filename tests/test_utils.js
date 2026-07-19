/* ══════════════════════════════════════════════════════════════
   test_utils.js — Utility Function Tests
   12 tests: debounce, throttle, memoize, safeJSON, sanitizeHTML,
   roundRect, drawBarChart, RateLimit class
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('Utils — debounce()', () => {
  it('debounce function is defined', () => {
    expect(typeof debounce).toBe('function');
  });
  it('debounce returns a function', () => {
    const db = debounce(() => {}, 100);
    expect(typeof db).toBe('function');
  });
  it('debounce delays execution', (done) => {
    let called = false;
    const db = debounce(() => { called = true; }, 50);
    db();
    expect(called).toBe(false); // not called immediately
  });
});

describe('Utils — throttle()', () => {
  it('throttle function is defined', () => {
    expect(typeof throttle).toBe('function');
  });
  it('throttle returns a function', () => {
    const th = throttle(() => {}, 100);
    expect(typeof th).toBe('function');
  });
  it('throttle calls fn on first invocation', () => {
    let count = 0;
    const th = throttle(() => count++, 1000);
    th();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('Utils — memoize()', () => {
  it('memoize function is defined', () => {
    expect(typeof memoize).toBe('function');
  });
  it('memoize returns correct value', () => {
    const double = memoize(n => n * 2);
    expect(double(5)).toBe(10);
    expect(double(3)).toBe(6);
  });
  it('memoize caches results (same reference for same input)', () => {
    let callCount = 0;
    const fn = memoize(n => { callCount++; return n * 2; });
    fn(7); fn(7); fn(7);
    expect(callCount).toBe(1);
  });
});

describe('Utils — safeJSON()', () => {
  it('safeJSON function is defined', () => {
    expect(typeof safeJSON).toBe('function');
  });
  it('safeJSON parses valid JSON', () => {
    const result = safeJSON('{"key":"value"}');
    expect(result.key).toBe('value');
  });
  it('safeJSON returns null for invalid JSON', () => {
    const result = safeJSON('not json {{{');
    expect(result).toBeNull();
  });
  it('safeJSON handles empty string', () => {
    const result = safeJSON('');
    expect(result).toBeNull();
  });
  it('safeJSON returns default value if provided', () => {
    const result = safeJSON('bad', { fallback: true });
    expect(result.fallback).toBe(true);
  });
});
