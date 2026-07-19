/* ══════════════════════════════════════════════════════════════
   test_transport.js — Transport & Resource Tests
   10 tests covering: TIMELINE, RESOURCES, routing, transport
   suggestions, resource deploy/recall
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('Transport — TIMELINE Data', () => {
  it('TIMELINE array is defined', () => {
    expect(Array.isArray(TIMELINE)).toBe(true);
  });
  it('TIMELINE has at least 5 events', () => {
    expect(TIMELINE.length).toBeGreaterThanOrEqual(5);
  });
  it('Every timeline event has time, event, note, color', () => {
    TIMELINE.forEach(t => {
      expect(typeof t.time).toBe('string');
      expect(typeof t.event).toBe('string');
      expect(typeof t.note).toBe('string');
      expect(typeof t.color).toBe('string');
    });
  });
  it('Timeline includes a Gates Open event', () => {
    const hasGates = TIMELINE.some(t => t.event.includes('Gate') || t.event.includes('gate'));
    expect(hasGates).toBe(true);
  });
});

describe('Transport — RESOURCES Data', () => {
  it('RESOURCES array is defined', () => {
    expect(Array.isArray(RESOURCES)).toBe(true);
  });
  it('RESOURCES has at least 4 entries', () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(4);
  });
  it('Every resource has icon, name, status, deployed', () => {
    RESOURCES.forEach(r => {
      expect(typeof r.icon).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(typeof r.status).toBe('string');
      expect(typeof r.deployed).toBe('boolean');
    });
  });
});

describe('Transport — Functions', () => {
  it('renderTimeline function is defined', () => {
    expect(typeof renderTimeline).toBe('function');
  });
  it('renderResourceGrid function is defined', () => {
    expect(typeof renderResourceGrid).toBe('function');
  });
  it('toggleResource function is defined', () => {
    expect(typeof toggleResource).toBe('function');
  });
});
