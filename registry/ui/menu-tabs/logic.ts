/** Next tab index for arrow keys, Home and End. RTL swaps Left and Right. Null when the key isn't a tab move. */
export function moveTab(current: number, count: number, key: string, rtl = false): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const dir = key === "ArrowRight" ? (rtl ? -1 : 1) : key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
  if (!dir) return null;
  return (current + dir + count) % count;
}
