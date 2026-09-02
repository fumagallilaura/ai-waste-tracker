import { expect, test } from "@playwright/test";

const PASSWORD = "secret123";
let unique = 0;
let EMAIL = "";
let RECIPE = "";
let PRODUCTION = "";

test.describe("Fluxo completo: receita → produção → compras → desperdício", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    unique = Date.now();
    EMAIL = `e2e-flow-${unique}@test.com`;
    RECIPE = `E2E Panacota ${unique}`;
    PRODUCTION = `E2E Evento ${unique}`;

    await page.goto("/register");
    await page.getByTestId("register-email").fill(EMAIL);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-confirm").fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  async function createRecipe(page: import("@playwright/test").Page) {
    await page.goto("/recipes/new");
    await page.getByPlaceholder("Ex: Panacota, Feijoada, Macarrão...").fill(RECIPE);
    await page.getByPlaceholder("Ex: 10").fill("10");

    // umidade default é "g"; 500g de farinha a R$ 0,02/g
    const row = page.locator("div.col-span-4");
    await row.getByPlaceholder("Ex: farinha de trigo").fill("farinha");
    await page.getByPlaceholder("Ex: 500").fill("500");
    await page.getByPlaceholder("Ex: 5.99").fill("0.02");

    await page.getByRole("button", { name: "Salvar receita" }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByText(RECIPE)).toBeVisible();
  }

  test("cria receita e ela aparece na lista", async ({ page }) => {
    await createRecipe(page);
  });

  test("produção com receita gera lista de compras escalada (R2/D009)", async ({ page }) => {
    await createRecipe(page);

    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill(PRODUCTION);
    await page.locator("select").first().selectOption("casamento");
    await page.locator('input[type="date"]').fill("2026-10-10");
    await page.getByPlaceholder("Ex: 100").fill("30");

    // Fluxo A: selecionar a receita (modo "Usar receitas cadastradas" é default)
    await page.locator("input[type=checkbox]").first().check();

    await page.getByRole("button", { name: "Criar produção" }).click();
    await expect(page).toHaveURL(/\/productions$/);
    await expect(page.getByText(PRODUCTION)).toBeVisible();

    // Abrir a produção e conferir a lista
    await page.getByText(PRODUCTION).first().click();
    await page.getByRole("button", { name: "Lista de Compras" }).click();

    // 30 convidados / rendimento 10 = escala 3x → 1500g = 1,5kg
    await expect(page.getByText("farinha")).toBeVisible();
    await expect(page.getByText(/1\.5 kg/)).toBeVisible();
  });

  test("registrar desperdício atualiza dashboard", async ({ page }) => {
    await createRecipe(page);

    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill(PRODUCTION);
    await page.locator('input[type="date"]').fill("2026-10-10");
    await page.getByPlaceholder("Ex: 100").fill("20");

    // Fluxo B: itens manuais (D002)
    await page.getByRole("button", { name: /Informar manualmente/ }).click();
    await page.getByPlaceholder("Ex: panacota, arroz, frango...").fill("panacota");
    await page.getByPlaceholder("Ex: 50").fill("50");
    await page.getByRole("button", { name: "Criar produção" }).click();

    await expect(page.getByText(PRODUCTION)).toBeVisible();
    await page.getByText(PRODUCTION).first().click();

    // Aba desperdício
    await page.getByRole("button", { name: "Desperdício" }).click();
    await page.getByPlaceholder("Ex: tomate, panacota...").fill("panacota");
    await page.getByPlaceholder("Ex: 500").fill("10");
    await page.getByPlaceholder("0", { exact: true }).fill("25");
    await page.locator("select").last().selectOption("produzi_demais");
    await page.getByRole("button", { name: "Registrar desperdício" }).click();

    await expect(page.getByText("R$ 25,00").first()).toBeVisible();

    // Status mudou para finalizado
    await expect(page.getByText("Finalizado")).toBeVisible();

    // Dashboard reflete o desperdício
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByTestId("metric-desperdicio")).toHaveText("R$ 25,00");
    await expect(page.getByTestId("metric-eventos")).toHaveText("1");
  });
});
