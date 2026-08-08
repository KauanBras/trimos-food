"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCategoriesAction } from "@/features/products/actions/product-actions";

type ManagedCategory = {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
};

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: ManagedCategory[];
}) {
  const [categories, setCategories] = useState(initialCategories);

  function update(index: number, values: Partial<ManagedCategory>) {
    setCategories((current) =>
      current.map((category, categoryIndex) =>
        categoryIndex === index ? { ...category, ...values } : category,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
  }

  return (
    <form action={saveCategoriesAction} className="space-y-5">
      <input type="hidden" name="categories" value={JSON.stringify(categories)} />

      {categories.map((category, index) => (
        <div key={category.id ?? `new-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_auto_auto] lg:items-start">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input value={category.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Ex.: Combinados" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea value={category.description} onChange={(event) => update(index, { description: event.target.value })} placeholder="Descrição opcional no menu" className="min-h-20" />
            </div>
            <label className="mt-7 flex items-center gap-2 text-sm font-medium">
              <Switch checked={category.isActive} onCheckedChange={(checked) => update(index, { isActive: checked })} />
              Ativa
            </label>
            <div className="mt-6 flex gap-1">
              <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Mover categoria para cima"><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={index === categories.length - 1} onClick={() => move(index, 1)} aria-label="Mover categoria para baixo"><ArrowDown className="size-4" /></Button>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="gap-2" onClick={() => setCategories([...categories, { name: "", description: "", isActive: true }])}><Plus className="size-4" /> Nova categoria</Button>
        <Button type="submit" className="bg-zinc-950 hover:bg-zinc-800">Guardar categorias e ordem</Button>
      </div>
    </form>
  );
}
