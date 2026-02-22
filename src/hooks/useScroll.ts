import { useState, useCallback } from 'react';

interface UseScrollResult {
  scrollOffset: number;
  scrollUp: () => void;
  scrollDown: (maxLines: number, viewportHeight: number) => void;
  resetScroll: () => void;
}

export function useScroll(): UseScrollResult {
  const [scrollOffset, setScrollOffset] = useState(0);

  const scrollUp = useCallback(() => {
    setScrollOffset(o => Math.max(0, o - 1));
  }, []);

  const scrollDown = useCallback((maxLines: number, viewportHeight: number) => {
    setScrollOffset(o => Math.min(Math.max(0, maxLines - viewportHeight), o + 1));
  }, []);

  const resetScroll = useCallback(() => {
    setScrollOffset(0);
  }, []);

  return { scrollOffset, scrollUp, scrollDown, resetScroll };
}
