import { expect, test } from "@playwright/test";

const PASSWORD = "secret123";
let unique = 0;
let EMAIL = "";

test.describe.configure({ mode: "serial" });

test.describe("UX: rascunho, limpar e análises", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    unique = Date.now();
    EMAIL = `e2e-ux-${unique}@test.com`;
    await page.goto("/register");
    await page.getByTestId("register-email").fill(EMAIL);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-confirm").fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  });

  test("rascunho de produção: sai e volta, retoma e limpa com modal", async ({ page }) => {
    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill("Festa do Rascunho");
    // espera o autosave (debounce de 500ms)
    await page.waitForTimeout(900);

    // sai sem salvar e volta
    await page.goto("/dashboard");
    await page.goto("/productions/new");

    // banner de rascunho oferece retomar
    const banner = page.getByTestId("draft-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Festa do Rascunho");

    await page.getByTestId("draft-resume").click();
    await expect(page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...")).toHaveValue(
      "Festa do Rascunho"
    );

    // botão Limpar abre modal explicando; confirmação reseta o form
    await page.getByTestId("clear-form").click();
    await expect(page.getByText("Começar do zero?")).toBeVisible();
    await expect(page.getByText("As produções que você já salvou continuam lá")).toBeVisible();
    await page.getByTestId("confirm-clear").click();
    await expect(
      page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...")
    ).toHaveValue("");

    // sem rascunho pendente ao voltar de novo
    await page.waitForTimeout(900);
    await page.goto("/dashboard");
    await page.goto("/productions/new");
    await expect(page.getByTestId("draft-banner")).toBeHidden();
  });

  test("análises: comparação de eventos e sugestões após balanço", async ({ page }) => {
    // cria evento manual e registra balanço para ter dados
    await page.goto("/productions/new");
    await page.getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...").fill("Evento Análise");
    await page.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: /Informar itens diretamente/ }).click();
    await page.getByPlaceholder("Ex: brigadeiro, panacota...").first().fill("canapé");
    await page.getByPlaceholder("Ex: 70").fill("100");
    await page.getByRole("button", { name: "Criar produção" }).click();
    await expect(page).toHaveURL(/\/productions\/[0-9a-f-]+.*tab=requisicao/, { timeout: 15_000 });

    await page.getByRole("button", { name: "Balanço do evento" }).click();
    await page.getByPlaceholder("Ex: brigadeiro, panacota...").fill("canapé");
    const numbers = page.locator('form input[type="number"]');
    await numbers.nth(0).fill("100");
    await numbers.nth(1).fill("75");
    await numbers.nth(2).fill("25");
    await numbers.nth(3).fill("0");
    await numbers.nth(4).fill("30");
    await page.getByRole("button", { name: "Registrar balanço" }).click();
    await expect(page.getByText("Finalizado")).toBeVisible();

    // área de análises
    await page.getByRole("link", { name: "Análises" }).click();
    await expect(page).toHaveURL(/\/analises$/);
    await expect(page.getByTestId("resumo-eventos")).toHaveText("1");
    await expect(page.getByTestId("sugestoes")).toBeVisible();
    await expect(page.getByText(/canapé|Evento Análise|Consumo médio/i).first()).toBeVisible();
  });
});
