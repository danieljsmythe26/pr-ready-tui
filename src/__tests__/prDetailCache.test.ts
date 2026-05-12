import { describe, it, expect, beforeEach } from 'vitest';
import {
  keyFor,
  getCached,
  setCached,
  getInflight,
  startInflight,
  clearInflight,
  __testing,
  type DetailPayload,
} from '../hooks/prDetailCache.js';

const emptyDetail: DetailPayload = {
  reviewComments: [],
  structuredConversationComments: [],
  commitDates: [],
  conversationComments: '',
};

describe('prDetailCache', () => {
  beforeEach(() => {
    __testing.resetAll();
  });

  describe('keyFor', () => {
    it('includes owner, repo, and number — not just repo and number', () => {
      const acmePR = { repo: { owner: 'acme', repo: 'widgets' }, number: 42 };
      const otherPR = { repo: { owner: 'other-org', repo: 'widgets' }, number: 42 };
      expect(keyFor(acmePR)).toBe('acme/widgets/42');
      // Same repo name + number, different owner — must not collide.
      expect(keyFor(otherPR)).toBe('other-org/widgets/42');
      expect(keyFor(acmePR)).not.toBe(keyFor(otherPR));
    });
  });

  describe('updatedAt cache', () => {
    it('cache hit when updatedAt matches; miss when it does not', () => {
      const key = 'acme/widgets/42';
      const detail: DetailPayload = {
        ...emptyDetail,
        conversationComments: 'alice (2026-05-01T00:00:00Z):\nhi\n---',
      };
      setCached(key, '2026-05-01T00:00:00Z', detail);

      // Matching updatedAt → returns the cached payload
      expect(getCached(key, '2026-05-01T00:00:00Z')).toBe(detail);

      // Stale updatedAt → cache miss
      expect(getCached(key, '2026-05-02T00:00:00Z')).toBeUndefined();
    });

    it('returns undefined for an unseen key', () => {
      expect(getCached('never/seen/1', '2026-05-01T00:00:00Z')).toBeUndefined();
    });

    it('setCached overwrites prior entry on refetch', () => {
      const key = 'acme/widgets/42';
      setCached(key, '2026-05-01T00:00:00Z', emptyDetail);
      const fresher: DetailPayload = { ...emptyDetail, conversationComments: 'new' };
      setCached(key, '2026-05-02T00:00:00Z', fresher);
      expect(getCached(key, '2026-05-01T00:00:00Z')).toBeUndefined();
      expect(getCached(key, '2026-05-02T00:00:00Z')).toBe(fresher);
    });
  });

  describe('inflight abort manager', () => {
    it('starting a new inflight aborts the prior one for the same key', () => {
      const key = 'acme/widgets/42';
      const first = startInflight(key);
      expect(first.signal.aborted).toBe(false);
      expect(getInflight(key)).toBe(first);

      const second = startInflight(key);
      // First was aborted; second is now the active controller.
      expect(first.signal.aborted).toBe(true);
      expect(second.signal.aborted).toBe(false);
      expect(getInflight(key)).toBe(second);
    });

    it('clearInflight only removes the entry if the controller still matches', () => {
      const key = 'acme/widgets/42';
      const first = startInflight(key);
      // A second start replaces first — but does not abort it AFTER we got the new ref.
      const second = startInflight(key);

      // first.abort was called by startInflight when second began. Now first tries to
      // clear itself (e.g. it finished/errored late): it should NOT remove the second.
      clearInflight(key, first);
      expect(getInflight(key)).toBe(second);

      // Second clears itself when its fetch resolves.
      clearInflight(key, second);
      expect(getInflight(key)).toBeUndefined();
    });

    it('different keys do not interfere', () => {
      const a = startInflight('acme/widgets/1');
      const b = startInflight('acme/widgets/2');
      expect(a.signal.aborted).toBe(false);
      expect(b.signal.aborted).toBe(false);
    });
  });
});
