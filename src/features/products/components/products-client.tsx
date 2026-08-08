"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  Pencil,
  Copy,
  GripVertical,
  Settings2,
  Package,
  Plus,
  ArrowUp,
  ArrowDown,
  ListTree,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { duplicateProductAction, setProductAvailabilityAction, updateProductOrderAction } from "@/features/products/actions/product-actions";
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
    sort_order: number;
  } | null;
};

type Props = {
  restaurantId: string;
  initialProducts: Product[];
};

export function ProductsClient({
  initialProducts,
}: Props) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const productsRef = useRef(initialProducts);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveProduct(overProductId: string) {
    if (!draggedProductId || draggedProductId === overProductId) return;
    const current = productsRef.current;
    const from = current.findIndex((product) => product.id === draggedProductId);
    const to = current.findIndex((product) => product.id === overProductId);
    if (from < 0 || to < 0) return;
    if (current[from].category_id !== current[to].category_id) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    productsRef.current = next;
    setProducts(next);
  }

  function persistOrder(nextProducts = productsRef.current) {
    setDraggedProductId(null);
    startTransition(async () => {
      try {
        await updateProductOrderAction(nextProducts.map((product) => product.id));
        toast.success("Ordem do menu guardada.");
        router.refresh();
      } catch (error) {
        productsRef.current = initialProducts;
        setProducts(initialProducts);
        toast.error("Não foi possível guardar a ordem.", { description: error instanceof Error ? error.message : undefined });
      }
    });
  }

  function moveProductBy(productId: string, offset: -1 | 1) {
    const current = productsRef.current;
    const from = current.findIndex((product) => product.id === productId);
    if (from < 0) return;
    const siblings = current.filter((product) => product.category_id === current[from].category_id);
    const siblingIndex = siblings.findIndex((product) => product.id === productId);
    const targetSibling = siblings[siblingIndex + offset];
    if (!targetSibling) return;
    const to = current.findIndex((product) => product.id === targetSibling.id);
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    productsRef.current = next;
    setProducts(next);
    persistOrder(next);
  }

  const productGroups = Array.from(products.reduce((groups, product) => {
    const key = product.category_id ?? "uncategorized";
    const existing = groups.get(key) ?? { key, name: product.categories?.name ?? "Sem categoria", sortOrder: product.categories?.sort_order ?? Number.MAX_SAFE_INTEGER, products: [] as Product[] };
    existing.products.push(product);
    groups.set(key, existing);
    return groups;
  }, new Map<string, { key: string; name: string; sortOrder: number; products: Product[] }>()).values()).sort((a, b) => a.sortOrder - b.sortOrder);

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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push("/restaurant/products/categories")}><ListTree className="size-4" /> Gerir categorias</Button>
          <Button variant="outline" className="gap-2" onClick={() => router.push("/restaurant/products/modifiers")}><Settings2 className="size-4" /> Gerir complementos</Button>
          <Button className="gap-2 bg-zinc-950" onClick={() => router.push("/restaurant/products/new")}><Plus className="size-4" /> Novo produto</Button>
        </div>
      </section>


      {products.length === 0 ? (
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
        <div className="space-y-8">
          {productGroups.map((group) => <section key={group.key} className="space-y-3">
            <div><h2 className="text-xl font-semibold">{group.name}</h2><p className="text-xs text-zinc-500">A ordem é guardada dentro desta categoria.</p></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {group.products.map((product, productIndex) => (
            <Card
              key={product.id}
              draggable={!isPending}
              onDragStart={() => setDraggedProductId(product.id)}
              onDragOver={(event) => { event.preventDefault(); moveProduct(product.id); }}
              onDragEnd={() => persistOrder()}
              className={`shadow-none transition ${draggedProductId === product.id ? "opacity-60" : ""}`}
            >
              <CardHeader className="flex flex-row items-start gap-3">
                <GripVertical className="mt-1 size-5 shrink-0 cursor-grab text-zinc-400" aria-label="Arrastar produto" />
                {product.image_url && <div role="img" aria-label={`Imagem de ${product.name}`} className="size-14 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${product.image_url})` }} />}
                <CardTitle className="flex-1">{product.name}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-2">

                <p className="text-sm text-zinc-500">
                  {product.categories?.name ?? "Sem categoria"}
                </p>

                <p className="text-xl font-semibold">
                  € {product.price.toFixed(2)}
                </p>

                <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-sm">
                  <span>{!product.is_active ? "Inativo" : product.is_available ? "Disponível" : "Indisponível"}</span>
                  <Switch disabled={isPending || !product.is_active} checked={product.is_available} onCheckedChange={(checked) => {
                    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, is_available: checked } : item));
                    startTransition(async () => {
                      try {
                        await setProductAvailabilityAction(product.id, checked);
                        toast.success(checked ? "Produto disponível." : "Produto indisponível.");
                        router.refresh();
                      } catch (error) {
                        setProducts((current) => current.map((item) => item.id === product.id ? { ...item, is_available: !checked } : item));
                        toast.error("Não foi possível alterar a disponibilidade.", { description: error instanceof Error ? error.message : undefined });
                      }
                    });
                  }} />
                </div>

                <Button
                  variant="outline"
                  className="mt-3 w-full gap-2"
                  onClick={() => {
                    router.push(`/restaurant/products/${product.id}/edit`);
                  }}
                >
                  <Pencil className="size-4" />
                  Editar produto
                </Button>

                <form action={duplicateProductAction.bind(null, product.id)}>
                  <Button type="submit" variant="ghost" className="w-full gap-2"><Copy className="size-4" /> Duplicar produto</Button>
                </form>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={isPending || productIndex === 0} onClick={() => moveProductBy(product.id, -1)}><ArrowUp className="size-4" /> Subir</Button>
                  <Button type="button" variant="outline" size="sm" disabled={isPending || productIndex === group.products.length - 1} onClick={() => moveProductBy(product.id, 1)}><ArrowDown className="size-4" /> Descer</Button>
                </div>

              </CardContent>
            </Card>
          ))}
            </div>
          </section>)}
        </div>
      )}

      {products.length > 1 && <p className="text-center text-xs text-zinc-500">Arraste os cartões ou use Subir/Descer para definir a ordem no menu.</p>}

    </div>
  );
}
