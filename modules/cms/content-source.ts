// The cms content source: saved documents come from the build's content snapshot (D33,
// starter/src/kit/content/snapshot.ts), so pages and server functions see exactly what was published.
// Picked up automatically by src/kit/content (no registration needed).
import snapshot from "virtual:kit/content-snapshot";

export default {
  async load(key: string): Promise<unknown | undefined> {
    return snapshot[key];
  },
};
