// Hosts the Vercel Web Analytics script needs. Added to the CSP only when hosting.analytics is on.

/** Dev builds load the debug script from here. Production uses the same-origin `/_vercel/insights/script.js`. */
export const ANALYTICS_SCRIPT_HOST = "https://va.vercel-scripts.com";
/** Where the browser sends the page-view beacon. */
export const ANALYTICS_CONNECT_HOST = "https://vitals.vercel-insights.com";

export function analyticsHosts(enabled: boolean): { script: string[]; connect: string[] } {
  return enabled
    ? { script: ["'self'", ANALYTICS_SCRIPT_HOST], connect: [ANALYTICS_CONNECT_HOST] }
    : { script: [], connect: [] };
}
