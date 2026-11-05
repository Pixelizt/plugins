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

test("registry blocks respond to the keyboard", async ({ page }) => {
  await page.goto("/kit-blocks");
  await expect(page.getByRole("heading", { name: "Menu" })).toBeVisible();
  const lunch = page.getByRole("tab", { name: "Lunch" });
  await page.getByRole("tab", { name: "Coffee" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(lunch).toBeFocused();
  await expect(lunch).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("A fixture quote for the block preview.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book a table" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open profile" })).toHaveAttribute("href", "https://instagram.com/example");
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
