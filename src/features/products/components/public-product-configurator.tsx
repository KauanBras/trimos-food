"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readCart, writeCart } from "@/features/cart/types";
import { PublicCartButton } from "@/features/cart/components/public-cart-button";

type Variant = { id: string; name: string; price: number };
type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  maxQuantity: number;
};
type ModifierGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
};

type Props = {
  restaurant: { id: string; slug: string; currencyCode: string };
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
  };
  variants: Variant[];
  groups: ModifierGroup[];
  tableCode?: string;
};

export function PublicProductConfigurator({
  restaurant,
  product,
  variants,
  groups,
  tableCode,
}: Props) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [selected, setSelected] = useState<
    Record<string, Record<string, number>>
  >({});
  const [quantity, setQuantity] = useState(1);
  const variant = variants.find((item) => item.id === variantId);
  const basePrice = variant?.price ?? product.price;
  const selectedOptions = groups.flatMap((group) =>
    group.options.flatMap((option) => {
      const quantity = selected[group.id]?.[option.id] ?? 0;
      return quantity > 0
        ? [{ ...option, quantity, groupId: group.id, groupName: group.name }]
        : [];
    }),
  );
  const unitPrice =
    basePrice +
    selectedOptions.reduce(
      (total, option) => total + option.priceDelta * option.quantity,
      0,
    );
  const valid = groups.every((group) => {
    const count = Object.values(selected[group.id] ?? {}).reduce(
      (total, quantity) => total + quantity,
      0,
    );
    return count >= group.minSelections && count <= group.maxSelections;
  });
  const money = useMemo(
    () =>
      new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: restaurant.currencyCode,
      }),
    [restaurant.currencyCode],
  );

  function setOptionQuantity(
    group: ModifierGroup,
    option: ModifierOption,
    quantity: number,
  ) {
    const current = selected[group.id] ?? {};
    const currentTotal = Object.values(current).reduce(
      (total, value) => total + value,
      0,
    );
    const currentQuantity = current[option.id] ?? 0;
    const allowed = Math.min(
      option.maxQuantity,
      group.maxSelections - (currentTotal - currentQuantity),
    );
    const nextQuantity = Math.max(0, Math.min(quantity, allowed));
    const next =
      group.maxSelections === 1 && nextQuantity > 0
        ? { [option.id]: 1 }
        : { ...current, [option.id]: nextQuantity };
    if (nextQuantity === 0) delete next[option.id];
    setSelected((value) => ({ ...value, [group.id]: next }));
  }

  function addToOrder() {
    if (!valid) {
      toast.error("Complete as escolhas obrigatórias.");
      return;
    }
    const current = readCart(restaurant.id);
    current.push({
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      variant: variant ? { id: variant.id, name: variant.name } : null,
      modifiers: selectedOptions.map((option) => ({
        groupId: option.groupId,
        groupName: option.groupName,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
        quantity: option.quantity,
      })),
      quantity,
      unitPrice,
    });
    writeCart(restaurant.id, current);
    toast.success("Produto adicionado ao pedido.");
  }

  return (
    <main className="min-h-screen bg-zinc-50 pb-32">
      <PublicCartButton restaurantId={restaurant.id} slug={restaurant.slug} tableCode={tableCode} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          className={buttonVariants({
            variant: "ghost",
            className: "mb-4 gap-2",
          })}
          href={`/r/${restaurant.slug}${tableCode ? `?table=${encodeURIComponent(tableCode)}` : ""}`}
        >
          <ArrowLeft className="size-4" /> Voltar ao menu
        </Link>
        <Card className="overflow-hidden border-zinc-200 shadow-none">
          {product.imageUrl && (
            <div
              className="h-72 bg-cover bg-center"
              style={{ backgroundImage: `url(${product.imageUrl})` }}
            />
          )}
          <CardContent className="space-y-7 p-6">
            <div>
              <h1 className="text-3xl font-semibold">{product.name}</h1>
              {product.description && (
                <p className="mt-2 leading-7 text-zinc-500">
                  {product.description}
                </p>
              )}
              <p className="mt-3 text-xl font-semibold">
                {money.format(basePrice)}
              </p>
            </div>
            {variants.length > 0 && (
              <section>
                <h2 className="font-semibold">Escolha uma variação</h2>
                <p className="text-sm text-zinc-500">Escolha obrigatória</p>
                <div className="mt-3 space-y-2">
                  {variants.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border p-4"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variant"
                          checked={variantId === item.id}
                          onChange={() => setVariantId(item.id)}
                        />{" "}
                        {item.name}
                      </span>
                      <span>{money.format(item.price)}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}
            {groups.map((group) => (
              <section key={group.id}>
                <h2 className="font-semibold">{group.name}</h2>
                <p className="text-sm text-zinc-500">
                  {group.minSelections > 0
                    ? `Escolha pelo menos ${group.minSelections}`
                    : "Opcional"}{" "}
                  · máximo {group.maxSelections} no total
                </p>
                <div className="mt-3 space-y-2">
                  {group.options.map((option) => {
                    const optionQuantity = selected[group.id]?.[option.id] ?? 0;
                    const groupTotal = Object.values(
                      selected[group.id] ?? {},
                    ).reduce((total, value) => total + value, 0);
                    const canIncrease =
                      optionQuantity < option.maxQuantity &&
                      groupTotal < group.maxSelections;
                    return (
                      <div
                        key={option.id}
                        className="flex items-center justify-between gap-4 rounded-xl border p-4"
                      >
                        <div>
                          <p className="font-medium">{option.name}</p>
                          <p className="text-sm text-zinc-500">
                            {option.priceDelta > 0
                              ? `+ ${money.format(option.priceDelta)} cada`
                              : "Incluído"}
                          </p>
                        </div>
                        {option.maxQuantity > 1 ? (
                          <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Diminuir ${option.name}`}
                              disabled={optionQuantity === 0}
                              onClick={() =>
                                setOptionQuantity(
                                  group,
                                  option,
                                  optionQuantity - 1,
                                )
                              }
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-6 text-center font-semibold">
                              {optionQuantity}
                            </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Aumentar ${option.name}`}
                              disabled={!canIncrease}
                              onClick={() =>
                                setOptionQuantity(
                                  group,
                                  option,
                                  optionQuantity + 1,
                                )
                              }
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <input
                            type={
                              group.maxSelections === 1 ? "radio" : "checkbox"
                            }
                            name={`group-${group.id}`}
                            checked={optionQuantity > 0}
                            onChange={() =>
                              setOptionQuantity(
                                group,
                                option,
                                optionQuantity > 0 ? 0 : 1,
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-4">
              <span className="font-medium">Quantidade</span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={quantity === 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center font-semibold">
                  {quantity}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((value) => value + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button
            className="h-12 w-full gap-2 bg-zinc-950"
            disabled={!valid}
            onClick={addToOrder}
          >
            <ShoppingBag className="size-5" /> Adicionar ·{" "}
            {money.format(unitPrice * quantity)}
          </Button>
        </div>
      </div>
    </main>
  );
}
