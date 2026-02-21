import { describe, it, expect } from 'vitest';
import { isBotAuthor } from '../types.js';

describe('isBotAuthor', () => {
  it('detects known bot authors', () => {
    expect(isBotAuthor('dependabot')).toBe(true);
    expect(isBotAuthor('dependabot[bot]')).toBe(true);
    expect(isBotAuthor('app/dependabot')).toBe(true);
    expect(isBotAuthor('renovate')).toBe(true);
    expect(isBotAuthor('renovate[bot]')).toBe(true);
    expect(isBotAuthor('snyk-bot')).toBe(true);
  });

  it('returns false for non-bot users', () => {
    expect(isBotAuthor('danieljsmythe26')).toBe(false);
    expect(isBotAuthor('some-random-user')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isBotAuthor('Dependabot')).toBe(true);
    expect(isBotAuthor('DEPENDABOT[BOT]')).toBe(true);
  });
});
