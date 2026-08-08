import type { MetadataRoute } from "next";

import { createClient } from "@/lib/supabase/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://trimos-food.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("slug, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  return [
    {
      url: siteUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/pricing`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/contact`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...(restaurants ?? []).map((restaurant) => ({
      url: `${siteUrl}/r/${restaurant.slug}`,
      lastModified: restaurant.updated_at,
      changeFrequency: "daily" as const,
      priority: 1,
    })),
  ];
}
