import { expect, test } from "@playwright/test";

const SEGMENTOS: Record<string, string> = {
  restaurante: "Restaurante",
  pizzaria: "Pizzaria",
};

test.describe("Landing — calculadora pública (SEO MVP, D007)", () => {
  test("calcula CMV e perda estimada", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Quanto você está/ })
    ).toBeVisible();

    await page.locator("select").first().selectOption("restaurante");
    await page.getByPlaceholder("Ex: 80000").fill("80000");
    await page.getByPlaceholder("Ex: 28000").fill("32000");
    await page.getByRole("button", { name: "Calcular desperdício" }).click();

    const result = page.locator("text=Resultado").first();
    await expect(result).toBeVisible();
    // CMV 40% > ideal 35% → perda de R$ 4.000
    await expect(page.getByText("Seu CMV", { exact: true })).toBeVisible();
    await expect(page.getByText("40%")).toBeVisible();
    await expect(page.getByText(/R\$ 4\.000/)).toBeVisible();
  });

  test("CTA leva ao cadastro", async ({ page }) => {
    await page.goto("/");
    await page.locator("select").first().selectOption("pizzaria");
    await page.getByPlaceholder("Ex: 80000").fill("50000");
    await page.getByPlaceholder("Ex: 28000").fill("20000");
    await page.getByRole("button", { name: "Calcular desperdício" }).click();

    const cta = page.getByRole("link", { name: /Quer descobrir/ });
    await expect(cta).toHaveAttribute("href", "/register");
  });

  test("links de auth no header funcionam", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("link", { name: "Criar conta grátis" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});
