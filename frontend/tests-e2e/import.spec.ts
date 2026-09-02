import { expect, test } from "@playwright/test";

const unique = Date.now();
let run = 0;

const IMPORTED = {
  nome: `Panacota importada ${unique}`,
  rendimento_base: 8,
  tipo: "sobremesa",
  ingredients: [
    {
      ingrediente: "cream cheese",
      quantidade: 400,
      unidade: "g",
      original: "400 g de cream cheese",
    },
    {
      ingrediente: "leite condensado",
      quantidade: 395,
      unidade: "g",
      original: "1 lata de leite condensado",
    },
  ],
  source_url: "https://exemplo.com/panacota",
};

test.describe("Importar receita da internet", () => {
  test.beforeEach(async ({ page }) => {
    run += 1;
    await page.goto("/register");
    await page.getByTestId("register-email").fill(`e2e-import-${unique}-${run}@test.com`);
    await page.getByTestId("register-password").fill("secret123");
    await page.getByTestId("register-confirm").fill("secret123");
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    await page.route("**/api/recipes/import", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(IMPORTED) });
    });
  });

  test("botão de import existe na lista de receitas", async ({ page }) => {
    await page.goto("/recipes");
    await expect(page.getByTestId("import-recipe-button")).toBeVisible();
  });

  test("importa, revisa e salva como receita", async ({ page }) => {
    await page.goto("/recipes");
    await page.getByTestId("import-recipe-button").click();
    await expect(page).toHaveURL(/\/recipes\/import$/);

    await page.getByTestId("import-url").fill("https://exemplo.com/panacota");
    await page.getByTestId("import-fetch-button").click();

    await expect(page.getByTestId("import-preview")).toBeVisible();
    await expect(page.getByTestId("import-ingredient-row")).toHaveCount(2);

    await page.getByTestId("import-use-button").click();

    // formulário de nova receita vem preenchido pelo import
    await expect(page).toHaveURL(/\/recipes\/new$/);
    await expect(page.getByPlaceholder("Ex: Panacota, Feijoada, Macarrão...")).toHaveValue(
      IMPORTED.nome
    );
    await expect(page.getByPlaceholder("Ex: 10")).toHaveValue("8");
    await expect(page.getByPlaceholder("Ex: farinha de trigo").first()).toHaveValue("cream cheese");

    // completa o preço (import não traz preço) e salva
    await page.getByPlaceholder("Ex: 5.99").first().fill("0.04");
    await page.getByRole("button", { name: "Salvar receita" }).click();

    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByText(IMPORTED.nome)).toBeVisible();
  });

  test("erro da API de import aparece para o usuário", async ({ page }) => {
    await page.unroute("**/api/recipes/import");
    await page.route("**/api/recipes/import", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Não encontramos uma receita estruturada nessa página. Cole os ingredientes manualmente.",
        }),
      });
    });

    await page.goto("/recipes/import");
    await page.getByTestId("import-url").fill("https://exemplo.com/random");
    await page.getByTestId("import-fetch-button").click();

    await expect(page.getByTestId("import-error")).toContainText("receita estruturada");
  });
});
