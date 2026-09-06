import { expect, test } from "@playwright/test";

test.describe("Landing — apresentação do app", () => {
  test("mostra proposta e funcionalidades principais", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Produza a quantidade certa/ })
    ).toBeVisible();
    await expect(page.getByText("Evento → ingredientes")).toBeVisible();
    await expect(page.getByText("Balanço do evento")).toBeVisible();
    await expect(page.getByText("Padrão por cliente")).toBeVisible();
    await expect(page.getByText("A regra dos 70%")).toBeVisible();
  });

  test("CTA leva ao cadastro", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Criar conta grátis" }).first();
    await expect(cta).toHaveAttribute("href", "/register");
  });

  test("links de auth funcionam", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Entrar" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
