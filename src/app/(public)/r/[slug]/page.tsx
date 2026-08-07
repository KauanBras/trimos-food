import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Clock3,
  MapPin,
  Search,
  ShoppingBag,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

type PublicRestaurantPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatMoney(
  value: number,
  currencyCode: string
) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

export default async function PublicRestaurantPage({
  params,
}: PublicRestaurantPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: restaurant,
    error: restaurantError,
  } = await supabase
    .from("restaurants")
    .select(`
      id,
      name,
      slug,
      description,
      logo_url,
      cover_url,
      city,
      address_line,
      currency_code,
      accepts_delivery,
      accepts_pickup,
      accepts_dine_in,
      accepts_reservations,
      status
    `)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (restaurantError) {
    throw new Error(
      `Não foi possível carregar o restaurante: ${restaurantError.message}`
    );
  }

  if (!restaurant) {
    notFound();
  }

  const [
    { data: categories, error: categoriesError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select(`
        id,
        name,
        description,
        sort_order
      `)
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("products")
      .select(`
        id,
        category_id,
        name,
        description,
        image_url,
        price,
        preparation_minutes,
        sort_order
      `)
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .eq("is_available", true)
      .order("sort_order", {
        ascending: true,
      }),
  ]);

  if (categoriesError) {
    throw new Error(
      `Não foi possível carregar as categorias: ${categoriesError.message}`
    );
  }

  if (productsError) {
    throw new Error(
      `Não foi possível carregar os produtos: ${productsError.message}`
    );
  }

  const services = [
    restaurant.accepts_delivery
      ? "Delivery"
      : null,
    restaurant.accepts_pickup
      ? "Takeaway"
      : null,
    restaurant.accepts_dine_in
      ? "Mesa"
      : null,
    restaurant.accepts_reservations
      ? "Reservas"
      : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-zinc-50 pb-28">
      <section className="relative">
        <div className="relative h-48 w-full overflow-hidden bg-zinc-900 sm:h-64">
          {restaurant.cover_url ? (
            <Image
              src={restaurant.cover_url}
              alt={restaurant.name}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-800 to-zinc-700" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </div>

        <div className="mx-auto max-w-5xl px-4">
          <div className="-mt-14 relative z-10 flex items-end gap-4">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-3xl border-4 border-zinc-50 bg-white shadow-lg">
              {restaurant.logo_url ? (
                <Image
                  src={restaurant.logo_url}
                  alt={`Logótipo ${restaurant.name}`}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-3xl font-semibold text-white">
                  {restaurant.name
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
              )}
            </div>

            <div className="pb-2">
              <Badge className="mb-2 bg-emerald-500 text-white hover:bg-emerald-500">
                Aberto
              </Badge>

              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                {restaurant.name}
              </h1>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {restaurant.description && (
              <p className="max-w-2xl text-zinc-600">
                {restaurant.description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-500">
              {(restaurant.city ||
                restaurant.address_line) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {[
                    restaurant.address_line,
                    restaurant.city,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}

              <span className="flex items-center gap-1.5">
                <Clock3 className="size-4" />
                25-35 min
              </span>
            </div>

            {services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Badge
                    key={service}
                    variant="outline"
                    className="rounded-full bg-white"
                  >
                    {service}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />

            <Input
              placeholder="Pesquisar no menu"
              className="h-12 rounded-2xl border-zinc-200 bg-white pl-12 shadow-sm"
              readOnly
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        {categories && categories.length > 0 && (
          <nav className="mt-8 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#categoria-${category.id}`}
                className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
              >
                {category.name}
              </a>
            ))}
          </nav>
        )}

        {!products?.length ? (
          <Card className="mt-10 border-dashed shadow-none">
            <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
              <ShoppingBag className="size-8 text-zinc-300" />

              <p className="mt-4 font-medium">
                Menu em preparação
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Ainda não existem produtos disponíveis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-10 space-y-12">
            {(categories ?? []).map(
              (category) => {
                const categoryProducts =
                  products.filter(
                    (product) =>
                      product.category_id ===
                      category.id
                  );

                if (!categoryProducts.length) {
                  return null;
                }

                return (
                  <section
                    key={category.id}
                    id={`categoria-${category.id}`}
                    className="scroll-mt-24"
                  >
                    <div className="mb-5">
                      <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
                        {category.name}
                      </h2>

                      {category.description && (
                        <p className="mt-1 text-sm text-zinc-500">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {categoryProducts.map(
                        (product) => (
                          <Link
                            key={product.id}
                            href={`/r/${restaurant.slug}/produto/${product.id}`}
                            className="group"
                          >
                            <Card className="h-full overflow-hidden border-zinc-200 bg-white shadow-none transition hover:-translate-y-0.5 hover:shadow-md">
                              <div className="flex min-h-40">
                                <CardContent className="flex flex-1 flex-col p-5">
                                  <h3 className="text-lg font-semibold text-zinc-950">
                                    {product.name}
                                  </h3>

                                  {product.description && (
                                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                                      {
                                        product.description
                                      }
                                    </p>
                                  )}

                                  <div className="mt-auto pt-5">
                                    <p className="text-lg font-semibold text-zinc-950">
                                      {formatMoney(
                                        product.price,
                                        restaurant.currency_code
                                      )}
                                    </p>

                                    {product.preparation_minutes && (
                                      <p className="mt-1 text-xs text-zinc-400">
                                        {
                                          product.preparation_minutes
                                        }{" "}
                                        min
                                      </p>
                                    )}
                                  </div>
                                </CardContent>

                                <div className="relative m-3 ml-0 w-32 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                                  {product.image_url ? (
                                    <Image
                                      src={
                                        product.image_url
                                      }
                                      alt={product.name}
                                      fill
                                      className="object-cover transition duration-300 group-hover:scale-105"
                                      sizes="128px"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-zinc-300">
                                      <ShoppingBag className="size-7" />
                                    </div>
                                  )}

                                  <div className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-white text-xl font-medium text-zinc-950 shadow-md">
                                    +
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </Link>
                        )
                      )}
                    </div>
                  </section>
                );
              }
            )}

            {products.some(
              (product) =>
                product.category_id === null
            ) && (
              <section>
                <h2 className="mb-5 text-2xl font-semibold tracking-tight text-zinc-950">
                  Outros
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  {products
                    .filter(
                      (product) =>
                        product.category_id ===
                        null
                    )
                    .map((product) => (
                      <Link
                        key={product.id}
                        href={`/r/${restaurant.slug}/produto/${product.id}`}
                      >
                        <Card className="border-zinc-200 bg-white shadow-none">
                          <CardContent className="p-5">
                            <h3 className="font-semibold">
                              {product.name}
                            </h3>

                            <p className="mt-3 font-semibold">
                              {formatMoney(
                                product.price,
                                restaurant.currency_code
                              )}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
