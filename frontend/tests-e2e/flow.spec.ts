import { expect, test } from "@playwright/test";

const PASSWORD = "secret123";
let unique = 0;
let EMAIL = "";
let RECIPE = "";
let PRODUCTION = "";

test.describe("Fluxo completo: receita → produção → requisição → balanço", () => {
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

    // 500g de farinha a R$ 10,00/kg
    const row = page.locator("div.col-span-4");
    await row.getByPlaceholder("Ex: farinha de trigo").fill("farinha");
    await page.getByPlaceholder("Ex: 500").fill("500");
    await page.getByPlaceholder("Ex: 5.99").fill("10");

    await page.getByRole("button", { name: "Salvar receita" }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByText(RECIPE)).toBeVisible();
  }

  test("cria receita e ela aparece na lista", async ({ page }) => {
    await createRecipe(page);
  });

  test("produção com escala direta gera requisição (10x receita)", async ({ page }) => {
    await createRecipe(page);

    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill(PRODUCTION);
    await page.locator("select").first().selectOption("casamento");
    await page.locator('input[type="date"]').fill("2026-10-10");

    // Fluxo A: selecionar a receita e informar quantas vezes fazer (escala direta)
    await expect(page.getByText(RECIPE)).toBeVisible({ timeout: 10_000 });
    await page.locator("input[type=checkbox]").first().check();
    await expect(page.locator('input[step="any"]')).toBeVisible();
    await page.locator('input[step="any"]').fill("10");

    await page.getByRole("button", { name: "Criar produção" }).click();

    // cai direto na requisição pronta
    await expect(page).toHaveURL(/\/productions\/[0-9a-f-]+.*tab=requisicao/, {
      timeout: 15_000,
    });

    // 10 × 500g = 5kg
    await expect(page.getByText("farinha")).toBeVisible();
    await expect(page.getByText(/Necessário: 5 kg/)).toBeVisible();
    await expect(page.getByText(/Pedir: 5 kg/)).toBeVisible();
  });

  test("balanço do evento (consumido/descartado/devolvido) atualiza dashboard", async ({ page }) => {
    await createRecipe(page);

    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill(PRODUCTION);
    await page.locator('input[type="date"]').fill("2026-10-10");

    // Fluxo B: itens manuais com quantidade total
    await page.getByRole("button", { name: /Informar itens diretamente/ }).click();
    await page.getByPlaceholder("Ex: brigadeiro, panacota...").first().fill("panacota");
    await page.getByPlaceholder("Ex: 70").fill("50");
    await page.getByRole("button", { name: "Criar produção" }).click();

    // cai direto na requisição; troca para o balanço
    await expect(page).toHaveURL(/\/productions\/[0-9a-f-]+.*tab=requisicao/, {
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Balanço do evento" }).click();

    await page.getByPlaceholder("Ex: brigadeiro, panacota...").fill("panacota");

    const numbers = page.locator('form input[type="number"]');
    await numbers.nth(0).fill("10"); // produzido
    await numbers.nth(1).fill("3"); // consumido
    await numbers.nth(2).fill("2"); // descartado (exposto)
    await numbers.nth(3).fill("5"); // devolvido (não exposto)
    await numbers.nth(4).fill("25"); // custo do descartado

    await page.getByRole("button", { name: "Registrar balanço" }).click();

    await expect(page.getByText("R$ 25,00").first()).toBeVisible();
    await expect(page.getByText("Finalizado")).toBeVisible();

    // Dashboard reflete o descarte
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByTestId("metric-desperdicio")).toHaveText("R$ 25,00");
    await expect(page.getByTestId("metric-compras")).toBeVisible();
    await expect(page.getByText("1 evento(s) finalizado(s)")).toBeVisible();
  });

  test("estoque: entrada aparece e é listada", async ({ page }) => {
    await page.goto("/estoque");
    await page.getByPlaceholder("Ex: farinha de trigo").fill("farinha");
    await page.getByPlaceholder("Ex: 5").fill("2");
    await page.getByRole("button", { name: "Registrar movimentação" }).click();

    await expect(page.getByText("farinha")).toBeVisible();
    await expect(page.getByText("2 kg")).toBeVisible();
  });

  test("cliente: cria buffet com fator de produção", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await page.getByPlaceholder("Ex: Buffet Aurora, Casamento Silva...").fill(`Buffet E2E ${unique}`);
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText(`Buffet E2E ${unique}`)).toBeVisible();
    await expect(page.getByText("Fator de produção: 70%")).toBeVisible();
  });
});
