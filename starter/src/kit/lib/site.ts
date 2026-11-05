// The public address of the site, from client.yaml (pure). Kit code: do not edit in a client project.

/** "https://example.com" (no trailing slash): the base of every link an email or a feed carries. */
export const siteUrlOf = (cfg: { client: { domain: string } }): string => `https://${cfg.client.domain}`;
