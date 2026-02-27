import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PR } from '../types.js';
import { REPOS, isBotAuthor } from '../types.js';
import { listAllOpenPRs, getReviewComments, getConversationComments } from '../github.js';
import { computeScore } from '../scoring.js';

export type SortBy = 'score' | 'updated' | 'created';

interface UsePRsResult {
  prs: PR[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  hideBots: boolean;
  toggleBots: () => void;
  sortBy: SortBy;
  toggleSort: () => void;
  repoFilter: string | null;
  cycleRepoFilter: () => void;
  updatePR: (repoName: string, number: number, patch: Partial<PR>) => void;
}

export function usePRs(): UsePRsResult {
  const [allPRs, setAllPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideBots, setHideBots] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [repoFilter, setRepoFilter] = useState<string | null>(null);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { prs: rawPRs, errors } = await listAllOpenPRs(REPOS);
      // Fetch review comments and conversation comments for all PRs in parallel
      const withComments = await Promise.all(rawPRs.map(async pr => {
        const [reviewComments, conversationComments] = await Promise.all([
          getReviewComments(pr.repo, pr.number),
          getConversationComments(pr.repo, pr.number),
        ]);
        return { ...pr, reviewComments, conversationComments, reviewVerdict: null as string | null };
      }));
      const scored: PR[] = withComments.map(pr => {
        const scoreBreakdown = computeScore(pr);
        return { ...pr, score: scoreBreakdown.total, scoreBreakdown };
      });
      setAllPRs(scored);
      if (errors.length > 0) {
        setError(`Partial failures: ${errors.join('; ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch PRs');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  const toggleSort = useCallback(() => {
    setSortBy(s => s === 'score' ? 'updated' : s === 'updated' ? 'created' : 'score');
  }, []);

  const cycleRepoFilter = useCallback(() => {
    const repoNames = REPOS.map(r => r.repo);
    setRepoFilter(current => {
      if (current === null) return repoNames[0] ?? null;
      const idx = repoNames.indexOf(current);
      return idx < repoNames.length - 1 ? repoNames[idx + 1]! : null;
    });
  }, []);

  const updatePR = useCallback((repoName: string, number: number, patch: Partial<PR>) => {
    setAllPRs(prev => prev.map(pr =>
      pr.repo.repo === repoName && pr.number === number
        ? { ...pr, ...patch }
        : pr
    ));
  }, []);

  const visiblePRs = useMemo(() => {
    let filtered = hideBots ? allPRs.filter(pr => !isBotAuthor(pr.author)) : [...allPRs];
    if (repoFilter) {
      filtered = filtered.filter(pr => pr.repo.repo === repoFilter);
    }
    filtered.sort((a, b) => {
      if (sortBy === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.score - b.score;
    });
    return filtered;
  }, [allPRs, hideBots, repoFilter, sortBy]);

  return {
    prs: visiblePRs,
    loading,
    error,
    refresh: fetchPRs,
    hideBots,
    toggleBots: () => setHideBots(v => !v),
    sortBy,
    toggleSort,
    repoFilter,
    cycleRepoFilter,
    updatePR,
  };
}
