import { expect, test } from "@playwright/test";

// Pages from the starter's own client.yaml. A client site's smoke test should follow that site's pages.
const pages = [
  { path: "/", heading: "h1", text: "Good coffee, slow mornings." },
  { path: "/about", heading: "h2", text: "Our story" },
  { path: "/visit", heading: "h2", text: "Visit us" },
] as const;

test("home page renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toHaveText("Good coffee, slow mornings.");
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo Café" })).toBeVisible();
});

test("robots.txt and llms files are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  const body = await robots.text();
  expect(body).toContain("User-agent: GPTBot");
  expect(body).toContain("Disallow: /admin");
  expect(body).toContain("Sitemap:");
  expect((await request.get("/llms.txt")).ok()).toBeTruthy();
  expect((await request.get("/llms-full.txt")).ok()).toBeTruthy();
});

for (const entry of pages) {
  test(`${entry.path} loads`, async ({ page }) => {
    const res = await page.goto(entry.path);
    expect(res?.status(), entry.path).toBeLessThan(400);
    await expect(page.locator(entry.heading).filter({ hasText: entry.text }).first()).toBeVisible();
    await expect(page.locator("main#main")).toBeVisible();
  });
}
