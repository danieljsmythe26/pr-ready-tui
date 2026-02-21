import { useState, useEffect, useCallback } from 'react';
import type { PR } from '../types.js';
import { REPOS, isBotAuthor } from '../types.js';
import { listAllOpenPRs } from '../github.js';
import { computeScore } from '../scoring.js';

interface UsePRsResult {
  prs: PR[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  hideBots: boolean;
  toggleBots: () => void;
}

export function usePRs(): UsePRsResult {
  const [allPRs, setAllPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideBots, setHideBots] = useState(true);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { prs: rawPRs, errors } = await listAllOpenPRs(REPOS);
      const scored: PR[] = rawPRs.map(pr => {
        const scoreBreakdown = computeScore(pr);
        return { ...pr, score: scoreBreakdown.total, scoreBreakdown };
      });
      scored.sort((a, b) => a.score - b.score);
      setAllPRs(scored);
      if (errors.length > 0) {
        setError(`Partial failures: ${errors.join('; ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch PRs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  const visiblePRs = hideBots
    ? allPRs.filter(pr => !isBotAuthor(pr.author))
    : allPRs;

  return {
    prs: visiblePRs,
    loading,
    error,
    refresh: fetchPRs,
    hideBots,
    toggleBots: () => setHideBots(v => !v),
  };
}
