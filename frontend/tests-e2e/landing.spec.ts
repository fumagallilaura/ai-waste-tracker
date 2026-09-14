import { expect, test } from "@playwright/test";

test.describe("Landing — apresentação do app", () => {
  test("mostra proposta e simulador interativo", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Produza certo/i })
    ).toBeVisible();
    await expect(page.getByTestId("landing-simulator")).toBeVisible();
    await expect(page.getByText("Quanto você deixa na mesa?")).toBeVisible();
    await expect(page.getByText("Monte o evento")).toBeVisible();
    await expect(page.getByText("Feche o balanço")).toBeVisible();
    await expect(page.getByText("Aprenda o cliente")).toBeVisible();
  });

  test("CTA leva ao cadastro", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Criar conta grátis" }).first();
    await expect(cta).toHaveAttribute("href", "/register");
  });

  test("links de auth funcionam", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /entrar/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
