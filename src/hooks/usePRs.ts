import { useState, useEffect, useCallback, useMemo } from 'react';
import type { PR } from '../types.js';
import { REPOS, isBotAuthor } from '../types.js';
import { listAllOpenPRs, getReviewComments, getConversationComments, getStructuredConversationComments, getCommitDates } from '../github.js';
import { getLocalPRState } from '../localState.js';
import { computeScore } from '../scoring.js';

export type SortBy = 'score' | 'updated' | 'created';

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]!, index);
    }
  });

  await Promise.all(workers);
  return results;
}

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
      const localStates = await mapWithConcurrency(rawPRs, 4, pr => getLocalPRState(pr));
      // Fetch review comments and conversation comments for all PRs in parallel
      const withComments = await Promise.all(rawPRs.map(async (pr, index) => {
        const [reviewComments, conversationComments, structuredConversationComments, commitDates] = await Promise.all([
          getReviewComments(pr.repo, pr.number),
          getConversationComments(pr.repo, pr.number),
          getStructuredConversationComments(pr.repo, pr.number),
          getCommitDates(pr.repo, pr.number),
        ]);
        const localState = localStates[index]!;
        return { ...pr, reviewComments, conversationComments, structuredConversationComments, commitDates, localState, reviewVerdict: null as string | null };
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

  const compareBySort = useCallback((a: PR, b: PR) => {
    if (sortBy === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.score - b.score;
  }, [sortBy]);

  const visiblePRs = useMemo(() => {
    let filtered = hideBots ? allPRs.filter(pr => !isBotAuthor(pr.author)) : [...allPRs];
    if (repoFilter) {
      filtered = filtered.filter(pr => pr.repo.repo === repoFilter);
    }
    const repoOrder = new Map(REPOS.map((repo, index) => [`${repo.owner}/${repo.repo}`, index]));
    filtered.sort((a, b) => {
      if (repoFilter === null) {
        const repoDelta = (repoOrder.get(`${a.repo.owner}/${a.repo.repo}`) ?? Number.MAX_SAFE_INTEGER)
          - (repoOrder.get(`${b.repo.owner}/${b.repo.repo}`) ?? Number.MAX_SAFE_INTEGER);
        if (repoDelta !== 0) return repoDelta;
      }
      return compareBySort(a, b);
    });
    return filtered;
  }, [allPRs, compareBySort, hideBots, repoFilter]);

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
