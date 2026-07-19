/* ══════════════════════════════════════════════════════════════
   test_ai.js — AI Decision Engine Tests
   18 tests covering: getAIResponse, intent detection, confidence
   scoring, all 4 personas, explainability, audit log
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('AI Engine — getAIResponse()', () => {
  it('getAIResponse is defined', () => {
    expect(typeof getAIResponse).toBe('function');
  });
  it('Returns a non-empty string', () => {
    const r = getAIResponse('hello', 'fan', 'en');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });
  it('Fan + seat query returns seat response', () => {
    const r = getAIResponse('where is my seat?', 'fan', 'en');
    expect(r.toLowerCase()).toContain('seat');
  });
  it('Fan + food query returns food response', () => {
    const r = getAIResponse('find food', 'fan', 'en');
    expect(r.toLowerCase()).toContain('food');
  });
  it('Fan + toilet query returns toilet/restroom response', () => {
    const r = getAIResponse('where is restroom', 'fan', 'en');
    const lower = r.toLowerCase();
    expect(lower.includes('restroom') || lower.includes('toilet')).toBe(true);
  });
  it('Fan + crowd query returns crowd/capacity response', () => {
    const r = getAIResponse('how crowded is it', 'fan', 'en');
    const lower = r.toLowerCase();
    expect(lower.includes('crowd') || lower.includes('capacity') || lower.includes('zone')).toBe(true);
  });
  it('Staff + incident query returns incident response', () => {
    const r = getAIResponse('show active incidents', 'staff', 'en');
    const lower = r.toLowerCase();
    expect(lower.includes('incident') || lower.includes('zone') || lower.includes('alert')).toBe(true);
  });
  it('Volunteer + protocol query returns protocol response', () => {
    const r = getAIResponse('emergency protocol', 'volunteer', 'en');
    const lower = r.toLowerCase();
    expect(lower.includes('protocol') || lower.includes('emergency') || lower.includes('volunteer')).toBe(true);
  });
  it('Organizer + summary query returns summary response', () => {
    const r = getAIResponse('event summary', 'organizer', 'en');
    const lower = r.toLowerCase();
    expect(lower.includes('revenue') || lower.includes('summary') || lower.includes('event')).toBe(true);
  });
  it('Unknown persona falls back to fan responses', () => {
    const r = getAIResponse('hello', 'unknown_persona', 'en');
    expect(r.length).toBeGreaterThan(0);
  });
  it('Non-english lang appends translation note', () => {
    const r = getAIResponse('hello', 'fan', 'hi');
    expect(r).toContain('HI');
  });
  it('English lang does NOT append translation note', () => {
    const r = getAIResponse('hello', 'fan', 'en');
    expect(r).not.toContain('[Translated to EN]');
  });
});

describe('AI Engine — Confidence & Decision Engine', () => {
  it('buildAIDecision function is defined', () => {
    expect(typeof buildAIDecision).toBe('function');
  });
  it('buildAIDecision returns object with required keys', () => {
    const d = buildAIDecision('fan', 'seat', 'where is my seat');
    expect(typeof d.intent).toBe('string');
    expect(typeof d.decision).toBe('string');
    expect(typeof d.reason).toBe('string');
    expect(typeof d.confidence).toBe('number');
    expect(typeof d.alternative).toBe('string');
    expect(typeof d.expectedOutcome).toBe('string');
  });
  it('Confidence score is between 0.75 and 1.0', () => {
    const d = buildAIDecision('fan', 'seat', 'where is my seat');
    expect(d.confidence).toBeGreaterThan(0.75);
    expect(d.confidence).toBeLessThanOrEqual(1.0);
  });
  it('AuditLog is defined as an object', () => {
    expect(typeof AuditLog).toBe('object');
  });
  it('AuditLog.append is a function', () => {
    expect(typeof AuditLog.append).toBe('function');
  });
  it('AuditLog.getAll returns an array', () => {
    expect(Array.isArray(AuditLog.getAll())).toBe(true);
  });
});
