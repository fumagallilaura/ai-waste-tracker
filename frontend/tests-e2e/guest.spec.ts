import { expect, test } from "@playwright/test";

const PASSWORD = "secret123";
const EMAIL = `e2e-guest-${Date.now()}@test.com`;

test.describe("Fluxo visitante (sem login)", () => {
  test.setTimeout(90_000);

  test("cria 1 produção grátis, registra balanço e a 2ª exige login", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("landing-trial").click();
    await expect(page).toHaveURL(/\/comecar$/);

    // cria a produção com dois itens
    await page.getByPlaceholder("Ex: Aniversário da Maria").fill("E2E Visitante");
    await page.getByPlaceholder("Ex: brigadeiro").first().fill("brigadeiro");
    await page.getByPlaceholder("Ex: 70").first().fill("70");
    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByPlaceholder("Ex: brigadeiro").nth(1).fill("bolo de cenoura");
    await page.getByPlaceholder("Ex: 70").nth(1).fill("2");
    await page.locator("select").nth(1).selectOption("kg");

    await page.getByRole("button", { name: "Criar produção e ver a lista" }).click();
    await expect(page).toHaveURL(/\/comecar\/[0-9a-f-]+$/, { timeout: 15_000 });

    // requisição aparece com os dois itens (visitante não tem estoque: pedir tudo)
    await expect(page.getByText("brigadeiro")).toBeVisible();
    await expect(page.getByText(/Pedir: 70 unidade/)).toBeVisible();
    await expect(page.getByText(/Pedir: 2 kg/)).toBeVisible();

    // registra o balanço
    await page.getByRole("button", { name: "Balanço do evento" }).click();
    await page.getByPlaceholder("Ex: brigadeiro").fill("brigadeiro");
    const numbers = page.locator('form input[type="number"]');
    await numbers.nth(0).fill("70"); // produzido
    await numbers.nth(1).fill("60"); // consumido
    await numbers.nth(2).fill("10"); // descartado
    await numbers.nth(3).fill("0"); // devolvido
    await numbers.nth(4).fill("12"); // custo
    await page.getByRole("button", { name: "Registrar balanço" }).click();
    await expect(page.getByText("Balanço registrado!")).toBeVisible();

    // 2ª produção sem login → redireciona para login com o aviso
    await page.goto("/comecar");
    await page.getByPlaceholder("Ex: Aniversário da Maria").fill("Segunda produção");
    await page.getByPlaceholder("Ex: brigadeiro").first().fill("brigadeiro");
    await page.getByPlaceholder("Ex: 70").first().fill("70");
    await page.getByRole("button", { name: "Criar produção e ver a lista" }).click();
    await expect(page).toHaveURL(/\/login\?motivo=limite/, { timeout: 15_000 });
    await expect(page.getByTestId("auth-notice")).toContainText("produção grátis");
  });

  test("ao criar conta, a produção do visitante passa a ser sua", async ({ page }) => {
    await page.goto("/comecar");
    await page.getByPlaceholder("Ex: Aniversário da Maria").fill("E2E Claim");
    await page.getByPlaceholder("Ex: brigadeiro").first().fill("brigadeiro");
    await page.getByPlaceholder("Ex: 70").first().fill("70");
    await page.getByRole("button", { name: "Criar produção e ver a lista" }).click();
    await expect(page).toHaveURL(/\/comecar\/[0-9a-f-]+$/, { timeout: 15_000 });

    // cria a conta no mesmo browser → claim
    await page.goto("/register");
    await page.getByTestId("register-email").fill(EMAIL);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-confirm").fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    await page.goto("/productions");
    await expect(page.getByText("E2E Claim")).toBeVisible();
  });
});

test.describe("Sessão expirada", () => {
  test("token inválido redireciona para login com aviso", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dz_access_token", "token-invalido");
      window.localStorage.setItem("dz_refresh_token", "refresh-invalido");
    });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?expired=1/, { timeout: 15_000 });
    await expect(page.getByTestId("auth-notice")).toContainText("Sua sessão expirou");
  });
});
