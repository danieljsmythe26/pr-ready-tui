import { describe, it, expect } from 'vitest';
import { wordWrap } from '../wordwrap.js';

describe('wordWrap', () => {
  it('returns short line unchanged', () => {
    expect(wordWrap('hello world', 20)).toEqual(['hello world']);
  });

  it('breaks at word boundary', () => {
    expect(wordWrap('the quick brown fox jumps', 15)).toEqual([
      'the quick brown',
      'fox jumps',
    ]);
  });

  it('hard breaks words longer than maxWidth', () => {
    expect(wordWrap('abcdefghij rest', 5)).toEqual([
      'abcde',
      'fghij',
      'rest',
    ]);
  });

  it('returns single empty string for empty input', () => {
    expect(wordWrap('', 10)).toEqual(['']);
  });

  it('returns line at exact maxWidth unchanged', () => {
    expect(wordWrap('12345', 5)).toEqual(['12345']);
  });
});
