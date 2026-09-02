import { expect, test } from "@playwright/test";

const unique = Date.now();
const EMAIL = `e2e-auth-${unique}@test.com`;
const PASSWORD = "secret123";

test.describe("Autenticação", () => {
  test("área logada exige token", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("registro → dashboard → logout → login", async ({ page }) => {
    // Registro
    await page.goto("/register");
    await page.getByTestId("register-email").fill(EMAIL);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-confirm").fill(PASSWORD);
    await page.getByTestId("register-submit").click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("dashboard-metrics")).toBeVisible();

    // Logout
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/);

    // Login com as mesmas credenciais
    await page.getByTestId("login-email").fill(EMAIL);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("senha curta é bloqueada no client", async ({ page }) => {
    await page.goto("/register");
    await page.getByTestId("register-email").fill(`short-${unique}@test.com`);
    await page.getByTestId("register-password").fill("123");
    await page.getByTestId("register-confirm").fill("123");
    await page.getByTestId("register-submit").click({ force: true });

    await expect(page.getByTestId("auth-error")).toContainText("8 caracteres");
  });

  test("login com credencial errada mostra erro", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(EMAIL);
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
