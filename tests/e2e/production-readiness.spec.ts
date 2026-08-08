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
  expect(robots).toContain("Sitemap:");

  const sitemapResponse = await request.get("/sitemap.xml");
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("/r/hirotatsu-sushi");
});
