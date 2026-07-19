import { expect, test } from "@playwright/test";

test("mobile navigation is contained and exposes one labelled menu", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/orders");
  const menu = page.getByRole("button", { name: "Orders", exact: true });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("combobox", { name: "Viewing location" })).toBeVisible();
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Awaiting delivery" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("mobile Orders keeps customer context", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/orders");
  const firstOrder = page.locator("tbody tr").first();
  await expect(firstOrder).toContainText("Priya Nair");
  await expect(firstOrder).toContainText("07700 900606");
});

test("partial receiving exposes received and remaining quantities", async ({ page }) => {
  await page.goto("/ordering/outstanding");
  await expect(page.getByText("record partial deliveries", { exact: false })).toBeVisible();
  const quantity = page.getByRole("spinbutton", { name: /Copies received for/ }).first();
  await expect(quantity).toBeVisible();
  await expect(page.getByText(/0\/\d+ received/).first()).toBeVisible();
});

test("desktop grouped navigation exposes expansion state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/orders");
  await expect(page.getByRole("button", { name: /Ordering/ })).toHaveAttribute("aria-expanded", /true|false/);
});
