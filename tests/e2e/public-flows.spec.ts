import { expect, test, type Page } from "@playwright/test";

const restaurantSlug = process.env.E2E_RESTAURANT_SLUG ?? "hirotatsu-sushi";

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  return errors;
}

test("menu público abre sem imagens quebradas ou erros de hidratação", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);

  await page.goto(`/r/${restaurantSlug}`);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Super Hiro 44 Peças/i }),
  ).toBeVisible();

  const brokenImages = await page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter(
          (image) =>
            !(image as HTMLImageElement).complete ||
            (image as HTMLImageElement).naturalWidth === 0,
        )
        .map((image) => (image as HTMLImageElement).alt),
    );

  expect(brokenImages).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("quantidades dos complementos atualizam o preço e chegam ao carrinho", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);

  await page.goto(`/r/${restaurantSlug}`);
  await page.getByRole("link", { name: /Super Hiro 44 Peças/i }).click();
  await page.getByRole("button", { name: "Aumentar Molho de Soja" }).click();
  await page.getByRole("button", { name: "Aumentar Molho de Soja" }).click();
  await page.getByRole("button", { name: "Aumentar Molho Teriyaki" }).click();

  await expect(page.getByRole("button", { name: /Adicionar/ })).toContainText(
    "38,40",
  );
  await page.getByRole("button", { name: /Adicionar/ }).click();
  await page.goto(`/r/${restaurantSlug}/carrinho`);

  await expect(page.getByText("1x Extras: Molho Teriyaki")).toBeVisible();
  await expect(page.getByText("2x Extras: Molho de Soja")).toBeVisible();
  await expect(
    page.getByText("38,40 €", { exact: true }).first(),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("reserva pública é determinística e não gera erro de hidratação", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);

  await page.goto(`/r/${restaurantSlug}/reservar`);

  await expect(
    page.getByRole("heading", { name: /Reservar no/i }),
  ).toBeVisible();
  await expect(page.getByLabel("Data")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await expect(
    page.getByRole("button", { name: "Pedir reserva" }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("áreas privadas exigem autenticação", async ({ page }) => {
  await page.goto("/restaurant/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/driver/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("restaurante inexistente devolve página 404", async ({ page }) => {
  const response = await page.goto("/r/restaurante-inexistente-e2e");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
});
