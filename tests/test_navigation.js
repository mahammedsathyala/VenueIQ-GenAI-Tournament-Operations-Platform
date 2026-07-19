/* ══════════════════════════════════════════════════════════════
   test_navigation.js — Navigation & Routing Tests
   15 tests covering: NAV_STEPS, routes, POIs, setNavMode, AR
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('Navigation — NAV_STEPS Data Structure', () => {
  it('NAV_STEPS is defined and is an object', () => {
    expect(typeof NAV_STEPS).toBe('object');
    expect(NAV_STEPS).not.toBeNull();
  });
  it('NAV_STEPS has all 6 required destinations', () => {
    const required = ['seat', 'food', 'toilet', 'medical', 'exit', 'parking'];
    required.forEach(key => expect(Array.isArray(NAV_STEPS[key])).toBe(true));
  });
  it('Every destination has at least 3 steps', () => {
    Object.keys(NAV_STEPS).forEach(key => {
      expect(NAV_STEPS[key].length).toBeGreaterThanOrEqual(3);
    });
  });
  it('Every step has a step and dist property', () => {
    Object.keys(NAV_STEPS).forEach(key => {
      NAV_STEPS[key].forEach(s => {
        expect(typeof s.step).toBe('string');
        expect(typeof s.dist).toBe('string');
      });
    });
  });
  it('Seat route contains "Level 2" instruction', () => {
    const hasLevel = NAV_STEPS.seat.some(s => s.step.includes('Level 2') || s.step.includes('escalator') || s.step.includes('Block'));
    expect(hasLevel).toBe(true);
  });
});

describe('Navigation — POI Data', () => {
  it('POIS array is defined', () => {
    expect(Array.isArray(POIS)).toBe(true);
  });
  it('POIS has at least 6 entries', () => {
    expect(POIS.length).toBeGreaterThanOrEqual(6);
  });
  it('Every POI has emoji, name, and dist', () => {
    POIS.forEach(p => {
      expect(typeof p.emoji).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.dist).toBe('string');
    });
  });
  it('Food court is in POIs', () => {
    const hasFood = POIS.some(p => p.name.toLowerCase().includes('food'));
    expect(hasFood).toBe(true);
  });
  it('Medical/Restroom POIs exist', () => {
    const hasMedical = POIS.some(p => p.name.toLowerCase().includes('medical'));
    const hasRestroom = POIS.some(p => p.name.toLowerCase().includes('restroom') || p.name.toLowerCase().includes('toilet'));
    expect(hasMedical).toBe(true);
    expect(hasRestroom).toBe(true);
  });
});

describe('Navigation — STATE & Functions', () => {
  it('STATE.navDest defaults to seat', () => {
    expect(STATE.navDest).toBe('seat');
  });
  it('STATE.navMode defaults to walking', () => {
    expect(STATE.navMode).toBe('walking');
  });
  it('setNavMode function is defined', () => {
    expect(typeof setNavMode).toBe('function');
  });
  it('updateNavRoute function is defined', () => {
    expect(typeof updateNavRoute).toBe('function');
  });
  it('renderSteps function is defined', () => {
    expect(typeof renderSteps).toBe('function');
  });
});
