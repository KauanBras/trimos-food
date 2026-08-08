"use client";

import { createProductAction } from "@/features/products/actions/product-actions";
import { Button } from "@/components/ui/button";

type Category = {
  id: string;
  name: string;
};

type Props = {
  categories: Category[];
};

export function ProductForm({
  categories,
}: Props) {
  return (
    <form
      action={createProductAction}
      className="space-y-5 rounded-3xl border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="text-sm font-medium">
          Categoria
        </label>

        <select
          name="categoryId"
          className="mt-2 w-full rounded-xl border px-4 py-3"
        >
          <option value="">
            Sem categoria
          </option>

          {categories.map((category) => (
            <option
              key={category.id}
              value={category.id}
            >
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">
          Nome do produto
        </label>

        <input
          name="name"
          required
          placeholder="Ex: Combo Hiro 44 peças"
          className="mt-2 w-full rounded-xl border px-4 py-3"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Descrição
        </label>

        <textarea
          name="description"
          placeholder="Descrição do produto"
          className="mt-2 min-h-28 w-full rounded-xl border px-4 py-3"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Preço
        </label>

        <input
          name="price"
          required
          min="0"
          type="number"
          step="0.01"
          placeholder="35.90"
          className="mt-2 w-full rounded-xl border px-4 py-3"
        />
      </div>

      <Button
        type="submit"
        className="bg-zinc-950"
      >
        Criar produto
      </Button>
    </form>
  );
}
