import { expect, test } from "@playwright/test";

test("saúde da aplicação confirma ligação à base de dados", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    database: "connected",
  });
});

test("respostas incluem proteções essenciais do navegador", async ({
  request,
}) => {
  const response = await request.get("/r/hirotatsu-sushi");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response.headers()["permissions-policy"]).toContain(
    "geolocation=(self)",
  );
});

test("robots protege áreas privadas e publica o sitemap", async ({
  request,
}) => {
  const robotsResponse = await request.get("/robots.txt");
  const robots = await robotsResponse.text();

  expect(robots).toContain("Disallow: /restaurant/");
  expect(robots).toContain("Disallow: /driver/");
  expect(robots).toContain("Disallow: /admin/");
  expect(robots).toContain("Sitemap:");

  const sitemapResponse = await request.get("/sitemap.xml");
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("/r/hirotatsu-sushi");
  expect(sitemap).toContain("/pricing");
});

test("vitrine comercial apresenta produto, preços e contacto", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "O restaurante inteiro, a funcionar num só lugar.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Começar", exact: true }),
  ).toBeVisible();

  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Um plano para cada fase." }),
  ).toBeVisible();

  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: "Pedir demonstração" }),
  ).toBeVisible();
});
