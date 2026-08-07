"use client";

import {
  Package,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  is_available: boolean;
  category_id: string | null;
  categories: {
    name: string;
  } | null;
};

type Props = {
  restaurantId: string;
  initialProducts: Product[];
};

export function ProductsClient({
  initialProducts,
}: Props) {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">

      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Produtos
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Gerencie o menu do restaurante.
          </p>
        </div>

        <Button className="gap-2 bg-zinc-950">
          <Plus className="size-4" />
          Novo produto
        </Button>
      </section>


      {initialProducts.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
            <Package className="size-10 text-zinc-400" />

            <p className="mt-4 font-medium">
              Nenhum produto cadastrado
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Comece criando os produtos do seu menu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {initialProducts.map((product) => (
            <Card
              key={product.id}
              className="shadow-none"
            >
              <CardHeader>
                <CardTitle>
                  {product.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">

                <p className="text-sm text-zinc-500">
                  {product.categories?.name ?? "Sem categoria"}
                </p>

                <p className="text-xl font-semibold">
                  € {product.price.toFixed(2)}
                </p>

                <p className="text-sm">
                  {product.is_available
                    ? "Disponível"
                    : "Indisponível"}
                </p>

              </CardContent>
            </Card>
          ))}

        </div>
      )}

    </div>
  );
}
