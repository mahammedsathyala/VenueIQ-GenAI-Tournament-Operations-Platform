/* ══════════════════════════════════════════════════════════════
   test_chat.js — AI Assistant & Chat Tests
   15 tests covering: sendMessage, personas, quick prompts,
   clearChat, exportChat, addUserMessage, addBotMessage
   ════════════════════════════════════════════════════════════ */
'use strict';

describe('Chat — AI_RESPONSES Data', () => {
  it('AI_RESPONSES object is defined', () => {
    expect(typeof AI_RESPONSES).toBe('object');
  });
  it('AI_RESPONSES has all 4 persona keys', () => {
    ['fan', 'staff', 'volunteer', 'organizer'].forEach(p =>
      expect(typeof AI_RESPONSES[p]).toBe('object')
    );
  });
  it('Every persona has a greet response', () => {
    ['fan', 'staff', 'volunteer', 'organizer'].forEach(p =>
      expect(typeof AI_RESPONSES[p].greet).toBe('string')
    );
  });
  it('Fan persona has seat, food, toilet, crowd, exit responses', () => {
    ['seat', 'food', 'toilet', 'crowd', 'exit'].forEach(key =>
      expect(typeof AI_RESPONSES.fan[key]).toBe('string')
    );
  });
  it('Staff persona has incident, patrol, crowd responses', () => {
    ['incident', 'patrol', 'crowd'].forEach(key =>
      expect(typeof AI_RESPONSES.staff[key]).toBe('string')
    );
  });
});

describe('Chat — QUICK_PROMPTS Data', () => {
  it('QUICK_PROMPTS is defined', () => {
    expect(typeof QUICK_PROMPTS).toBe('object');
  });
  it('QUICK_PROMPTS has entries for all 4 personas', () => {
    ['fan', 'staff', 'volunteer', 'organizer'].forEach(p =>
      expect(Array.isArray(QUICK_PROMPTS[p])).toBe(true)
    );
  });
  it('Fan has at least 4 quick prompts', () => {
    expect(QUICK_PROMPTS.fan.length).toBeGreaterThanOrEqual(4);
  });
  it('Quick prompts are non-empty strings', () => {
    QUICK_PROMPTS.fan.forEach(p => {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    });
  });
});

describe('Chat — Core Functions', () => {
  it('sendMessage function is defined', () => {
    expect(typeof sendMessage).toBe('function');
  });
  it('addUserMessage function is defined', () => {
    expect(typeof addUserMessage).toBe('function');
  });
  it('addBotMessage function is defined', () => {
    expect(typeof addBotMessage).toBe('function');
  });
  it('clearChat function is defined', () => {
    expect(typeof clearChat).toBe('function');
  });
  it('exportChat function is defined', () => {
    expect(typeof exportChat).toBe('function');
  });
  it('setPersona function is defined', () => {
    expect(typeof setPersona).toBe('function');
  });
  it('renderPromptChips function is defined', () => {
    expect(typeof renderPromptChips).toBe('function');
  });
});
