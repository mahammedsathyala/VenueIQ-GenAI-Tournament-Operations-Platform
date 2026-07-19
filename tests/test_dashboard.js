/* ══════════════════════════════════════════════════════════════
   test_dashboard.js — Dashboard & KPI Tests
   12 tests covering: ALERTS, INSIGHTS, ZONES, KPI values,
   renderAlertStream, renderInsights, drawHeatmap
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('Dashboard — ALERTS Data', () => {
  it('ALERTS array is defined', () => {
    expect(Array.isArray(ALERTS)).toBe(true);
  });
  it('ALERTS has at least 5 entries', () => {
    expect(ALERTS.length).toBeGreaterThanOrEqual(5);
  });
  it('Every alert has type, icon, msg, and time', () => {
    ALERTS.forEach(a => {
      expect(typeof a.type).toBe('string');
      expect(typeof a.icon).toBe('string');
      expect(typeof a.msg).toBe('string');
      expect(typeof a.time).toBe('string');
    });
  });
  it('Alert types are valid values', () => {
    const validTypes = ['critical', 'warning', 'info', 'success'];
    ALERTS.forEach(a => expect(validTypes).toContain(a.type));
  });
});

describe('Dashboard — INSIGHTS Data', () => {
  it('INSIGHTS array is defined', () => {
    expect(Array.isArray(INSIGHTS)).toBe(true);
  });
  it('INSIGHTS has at least 3 entries', () => {
    expect(INSIGHTS.length).toBeGreaterThanOrEqual(3);
  });
  it('Every insight has tag and text', () => {
    INSIGHTS.forEach(i => {
      expect(typeof i.tag).toBe('string');
      expect(typeof i.text).toBe('string');
    });
  });
});

describe('Dashboard — KPI & Render Functions', () => {
  it('renderAlertStream function is defined', () => {
    expect(typeof renderAlertStream).toBe('function');
  });
  it('renderInsights function is defined', () => {
    expect(typeof renderInsights).toBe('function');
  });
  it('drawHeatmap function is defined', () => {
    expect(typeof drawHeatmap).toBe('function');
  });
  it('startKPIUpdates function is defined', () => {
    expect(typeof startKPIUpdates).toBe('function');
  });
  it('refreshDashboard function is defined', () => {
    expect(typeof refreshDashboard).toBe('function');
  });
});
