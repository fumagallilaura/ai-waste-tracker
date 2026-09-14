import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "secret123";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function register(page: Page, label: string) {
  const email = `e2e-critical-${label}-${Date.now()}@test.com`;
  await page.goto("/register");
  await page.getByTestId("register-email").fill(email);
  await page.getByTestId("register-password").fill(PASSWORD);
  await page.getByTestId("register-confirm").fill(PASSWORD);
  await page.getByTestId("register-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function createManualProduction(
  page: Page,
  name: string,
  type: string,
  date: string,
) {
  await page.goto("/productions/new");
  await page
    .getByPlaceholder("Ex: Casamento Ana e Pedro, Almoço de terça...")
    .fill(name);
  await page.locator("select").first().selectOption(type);
  await page.locator('input[type="date"]').fill(date);
  await page.getByRole("button", { name: /Informar itens diretamente/ }).click();
  await page.getByPlaceholder("Ex: brigadeiro, panacota...").first().fill("bolo");
  await page.getByPlaceholder("Ex: 70").fill("10");
  await page.locator("select").last().selectOption("kg");
  await page.getByRole("button", { name: "Criar evento" }).click();
  await expect(page).toHaveURL(/\/productions\/[0-9a-f-]+.*tab=requisicao/, {
    timeout: 15_000,
  });
}

async function registerBalance(
  page: Page,
  { produzido, sobra, exposta, custo = "0" }: {
    produzido: string;
    sobra: string;
    exposta: boolean;
    custo?: string;
  },
) {
  await page.getByRole("button", { name: "Balanço do evento" }).click();
  await page.getByPlaceholder("Ex: brigadeiro, panacota...").fill("bolo");
  const numbers = page.locator('form input[type="number"]');
  await numbers.nth(0).fill(produzido);
  await numbers.nth(1).fill(sobra);
  await page
    .getByRole("button", { name: exposta ? "Sim, foi servida" : "Não, ficou intacta" })
    .click();
  if (exposta && custo !== "0") {
    await numbers.nth(2).fill(custo);
  }
  await page.getByRole("button", { name: "Registrar balanço" }).click();
  await expect(page.getByText("Balanço registrado!")).toBeVisible();
}

test.describe("Fluxos críticos de negócio", () => {
  test.setTimeout(60_000);

  test("desconta estoque na requisição e credita devolução no estoque", async ({
    page,
  }) => {
    await register(page, "estoque");

    await page.goto("/estoque");
    await page.getByPlaceholder("Ex: farinha de trigo").fill("bolo");
    await page.getByPlaceholder("Ex: 5").fill("2");
    await page.getByRole("button", { name: "Registrar movimentação" }).click();
    await expect(page.getByText("2 kg")).toBeVisible();

    await createManualProduction(page, "E2E Estoque", "casamento", dateDaysAgo(1));
    await expect(page.getByText(/Necessário: 10 kg/)).toBeVisible();
    await expect(page.getByText(/Estoque: 2 kg/)).toBeVisible();
    await expect(page.getByText(/Pedir: 8 kg/)).toBeVisible();

    await registerBalance(page, { produzido: "10", sobra: "6", exposta: false });
    await page.goto("/estoque");
    await expect(page.getByText("8 kg")).toBeVisible();
  });

  test("usa o histórico de turnos para sugerir produção", async ({ page }) => {
    await register(page, "historico");

    // Dois turnos no mesmo dia da semana tornam a sugestão determinística.
    for (const [index, daysAgo] of [7, 14].entries()) {
      await createManualProduction(
        page,
        `E2E Turno ${index}`,
        "turno_diario",
        dateDaysAgo(daysAgo),
      );
      await registerBalance(page, { produzido: "10", sobra: "0", exposta: true });
    }

    await page.goto("/analises");
    await page.getByRole("button", { name: "Dia a dia (comércio)" }).click();
    await expect(page.getByText("bolo", { exact: true })).toBeVisible();
    await expect(page.getByText("Sugestão", { exact: true })).toBeVisible();
    await expect(page.getByText("11,5")).toBeVisible();
    await expect(page.getByTestId("sugestoes")).toContainText("esgotou");
  });
});
