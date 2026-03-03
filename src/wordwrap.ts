/**
 * Word-wrap a single line of text to fit within maxWidth.
 * Breaks at word boundaries (spaces). Falls back to hard break
 * for words longer than maxWidth.
 */
export function wordWrap(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];

  const result: string[] = [];
  let remaining = text;

  while (remaining.length > maxWidth) {
    // Find last space within maxWidth
    const breakAt = remaining.lastIndexOf(' ', maxWidth);
    if (breakAt > 0) {
      result.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt + 1).trimStart();
    } else {
      // No space found — hard break
      result.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth).trimStart();
    }
  }

  if (remaining.length > 0) {
    result.push(remaining);
  }

  return result;
}
