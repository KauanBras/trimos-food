import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://trimos-food.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/r/"],
      disallow: [
        "/api/",
        "/driver/",
        "/restaurant/",
        "/login",
        "/register",
        "/onboarding",
        "/select-role",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
