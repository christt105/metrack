import { describe, expect, it } from 'vitest';
import { handleProblem, handleProblemKind, normalizeHandle } from '../src/index.js';

describe('normalizeHandle', () => {
  it('trims and lowercases', () => {
    expect(normalizeHandle('  Christian ')).toBe('christian');
  });
});

describe('handleProblem', () => {
  it('accepts lowercase letters, digits and hyphens', () => {
    expect(handleProblem('christian')).toBeNull();
    expect(handleProblem('a-b-3')).toBeNull();
    expect(handleProblem('abc')).toBeNull();
    expect(handleProblem('a'.repeat(30))).toBeNull();
  });

  it('rejects the wrong length', () => {
    expect(handleProblem('ab')).toMatch(/3 to 30/);
    expect(handleProblem('a'.repeat(31))).toMatch(/3 to 30/);
  });

  it('rejects other characters', () => {
    expect(handleProblem('Christian')).not.toBeNull();
    expect(handleProblem('chris_t')).not.toBeNull();
    expect(handleProblem('chris.t')).not.toBeNull();
    expect(handleProblem('chris t')).not.toBeNull();
    expect(handleProblem('cristián')).not.toBeNull();
  });

  it('rejects reserved words', () => {
    expect(handleProblem('admin')).toMatch(/reserved/);
    expect(handleProblem('api')).toMatch(/reserved/);
    expect(handleProblem('assets')).toMatch(/reserved/);
  });
});

describe('handleProblemKind', () => {
  it('names the rule that is broken', () => {
    expect(handleProblemKind('christian')).toBeNull();
    expect(handleProblemKind('ab')).toBe('length');
    expect(handleProblemKind('a'.repeat(31))).toBe('length');
    expect(handleProblemKind('chris_t')).toBe('characters');
    expect(handleProblemKind('admin')).toBe('reserved');
  });
});
