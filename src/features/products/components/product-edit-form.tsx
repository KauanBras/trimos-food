"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateProductAction } from "@/features/products/actions/product-actions";

type Category = { id: string; name: string };
type ModifierOption = { name: string; priceDelta: number; maxQuantity: number };
type ModifierGroup = {
  id?: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
};
type ProductVariant = { name: string; price: number; isActive: boolean; isAvailable: boolean };

type Props = {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    category_id: string | null;
    image_url: string | null;
    is_active: boolean;
    is_available: boolean;
  };
  categories: Category[];
  initialModifierGroups: ModifierGroup[];
  availableModifierGroups: ModifierGroup[];
  initialVariants: ProductVariant[];
};

const fieldClassName = "mt-2 w-full rounded-xl border px-4 py-3";

export function ProductEditForm({ product, categories, initialModifierGroups, availableModifierGroups, initialVariants }: Props) {
  const [groups, setGroups] = useState(initialModifierGroups);
  const [variants, setVariants] = useState(initialVariants);
  const [imagePreview, setImagePreview] = useState(product.image_url);
  const router = useRouter();
  const action = updateProductAction.bind(null, product.id);

  useEffect(() => () => { if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function updateGroup(index: number, next: Partial<ModifierGroup>) {
    setGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...next } : group
      )
    );
  }

  function updateOption(groupIndex: number, optionIndex: number, next: Partial<ModifierOption>) {
    const options = groups[groupIndex].options.map((option, currentIndex) =>
      currentIndex === optionIndex ? { ...option, ...next } : option
    );
    updateGroup(groupIndex, { options });
  }

  function updateVariant(index: number, next: Partial<ProductVariant>) {
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...next } : variant));
  }

  function moveVariant(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= variants.length) return;
    const next = [...variants];
    [next[index], next[destination]] = [next[destination], next[index]];
    setVariants(next);
  }

  return (
    <form action={action} className="space-y-6 rounded-3xl border bg-white p-6 shadow-sm">
      <input type="hidden" name="modifierGroups" value={JSON.stringify(groups)} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />

      <div>
        <label className="text-sm font-medium">Categoria</label>
        <select name="categoryId" defaultValue={product.category_id ?? ""} className={fieldClassName}>
          <option value="">Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-zinc-500">Pode atribuir ou alterar a categoria a qualquer momento.</p>
      </div>

      <div>
        <label className="text-sm font-medium">Imagem do produto</label>
        <input type="hidden" name="imageUrl" value={product.image_url ?? ""} />
        <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className={fieldClassName} onChange={(event) => { const file = event.target.files?.[0]; if (file) setImagePreview(URL.createObjectURL(file)); }} />
        <p className="mt-2 text-xs text-zinc-500">JPG, PNG, WebP ou GIF, até 5 MB. Uma nova imagem substitui a atual.</p>
        {imagePreview && <div role="img" aria-label="Pré-visualização da imagem do produto" className="mt-3 h-48 w-full rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${imagePreview})` }} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border p-4"><input name="isActive" type="checkbox" defaultChecked={product.is_active} /> Produto ativo</label>
        <label className="flex items-center gap-3 rounded-xl border p-4"><input name="isAvailable" type="checkbox" defaultChecked={product.is_available} /> Disponível para venda</label>
      </div>

      <div>
        <label className="text-sm font-medium">Nome do produto</label>
        <input name="name" required defaultValue={product.name} className={fieldClassName} />
      </div>

      <div>
        <label className="text-sm font-medium">Descrição</label>
        <textarea name="description" defaultValue={product.description ?? ""} className={`${fieldClassName} min-h-28`} />
      </div>

      <div>
        <label className="text-sm font-medium">Preço</label>
        <input name="price" required type="number" min="0" step="0.01" defaultValue={product.price} className={fieldClassName} />
        <p className="mt-2 text-xs text-zinc-500">Usado quando o produto não possui variações.</p>
      </div>

      <section className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Variações</h2><p className="text-sm text-zinc-500">Ex.: 8 unidades, 16 unidades ou tamanho grande.</p></div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => setVariants([...variants, { name: "", price: product.price, isActive: true, isAvailable: true }])}><Plus className="size-4" /> Adicionar variação</Button>
        </div>
        {variants.map((variant, variantIndex) => (
          <div key={variantIndex} className="grid gap-3 rounded-2xl border bg-zinc-50 p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <div><label className="text-sm font-medium">Nome</label><input required value={variant.name} onChange={(event) => updateVariant(variantIndex, { name: event.target.value })} placeholder="Ex: 16 unidades" className={fieldClassName} /></div>
            <div><label className="text-sm font-medium">Preço (€)</label><input required type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(variantIndex, { price: Number(event.target.value) })} className={fieldClassName} /></div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" disabled={variantIndex === 0} aria-label="Mover variação para cima" onClick={() => moveVariant(variantIndex, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" disabled={variantIndex === variants.length - 1} aria-label="Mover variação para baixo" onClick={() => moveVariant(variantIndex, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Remover variação" onClick={() => setVariants(variants.filter((_, index) => index !== variantIndex))}><Trash2 className="size-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-4 sm:col-span-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(variantIndex, { isActive: event.target.checked })} /> Ativa</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variant.isAvailable} onChange={(event) => updateVariant(variantIndex, { isAvailable: event.target.checked })} /> Disponível</label>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Complementos</h2>
            <p className="text-sm text-zinc-500">Crie grupos como “Escolha o molho” ou “Extras”.</p>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => setGroups([...groups, { name: "", minSelections: 0, maxSelections: 1, options: [{ name: "", priceDelta: 0, maxQuantity: 1 }] }])}>
            <Plus className="size-4" /> Adicionar grupo
          </Button>
        </div>

        {availableModifierGroups.some((candidate) => !groups.some((group) => group.id === candidate.id)) && (
          <div className="rounded-2xl border p-4">
            <p className="mb-3 text-sm font-medium">Associar grupo reutilizável</p>
            <div className="flex flex-wrap gap-2">
              {availableModifierGroups.filter((candidate) => !groups.some((group) => group.id === candidate.id)).map((candidate) => (
                <Button key={candidate.id} type="button" size="sm" variant="outline" onClick={() => setGroups([...groups, candidate])}>+ {candidate.name}</Button>
              ))}
            </div>
          </div>
        )}

        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-4 rounded-2xl border bg-zinc-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Nome do grupo</label>
                <input required disabled={Boolean(group.id)} value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} placeholder="Ex: Extras" className={fieldClassName} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="mt-7" aria-label="Remover grupo" onClick={() => setGroups(groups.filter((_, index) => index !== groupIndex))}>
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Mínimo de escolhas</label>
                <input disabled={Boolean(group.id)} type="number" min="0" max={group.maxSelections} value={group.minSelections} onChange={(event) => updateGroup(groupIndex, { minSelections: Number(event.target.value) })} className={fieldClassName} />
              </div>
              <div>
                <label className="text-sm font-medium">Máximo de escolhas</label>
                <input disabled={Boolean(group.id)} type="number" min="1" value={group.maxSelections} onChange={(event) => updateGroup(groupIndex, { maxSelections: Number(event.target.value) })} className={fieldClassName} />
              </div>
            </div>

            <div className="space-y-3">
              {group.options.map((option, optionIndex) => (
                <div key={optionIndex} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
                  <div>
                    <label className="text-sm font-medium">Opção</label>
                    <input required disabled={Boolean(group.id)} value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })} placeholder="Ex: Molho teriyaki" className={fieldClassName} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Preço extra (€)</label>
                    <input disabled={Boolean(group.id)} type="number" min="0" step="0.01" value={option.priceDelta} onChange={(event) => updateOption(groupIndex, optionIndex, { priceDelta: Number(event.target.value) })} className={fieldClassName} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Máx. quantidade</label>
                    <input disabled={Boolean(group.id)} type="number" min="1" max="99" value={option.maxQuantity} onChange={(event) => updateOption(groupIndex, optionIndex, { maxQuantity: Number(event.target.value) })} className={fieldClassName} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover opção" disabled={Boolean(group.id) || group.options.length === 1} onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {!group.id && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => updateGroup(groupIndex, { options: [...group.options, { name: "", priceDelta: 0, maxQuantity: 1 }] })}>
                <Plus className="size-4" /> Adicionar opção
              </Button>}
            </div>
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <Button type="submit" className="bg-zinc-950">Guardar alterações</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/restaurant/products")}>Cancelar</Button>
      </div>
    </form>
  );
}
