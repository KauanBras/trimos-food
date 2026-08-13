"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CreditCard, LoaderCircle, LocateFixed, Minus, Plus, ShoppingBag, Smartphone, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readCart, type CartItem, writeCart } from "@/features/cart/types";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { DemoModeBanner } from "@/components/public/demo-mode-banner";

type Props = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
    acceptsDelivery: boolean;
    acceptsPickup: boolean;
    acceptsDineIn: boolean;
    isOpen: boolean;
    operatingLabel: string;
    isDemo: boolean;
  };
  settings: {
    minimumOrderAmount: number;
    defaultDeliveryFee: number;
    deliveryFeePerKm: number;
    deliveryRadiusKm: number;
    deliveryOriginLatitude: number | null;
    deliveryOriginLongitude: number | null;
    freeDeliveryFrom: number | null;
    defaultPreparationMinutes: number;
    acceptsCash: boolean;
    acceptsTerminal: boolean;
    acceptsMbWay: boolean;
  };
  table: { name: string; code: string } | null;
};

type DeliveryLocation = { latitude: number; longitude: number };
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

function distanceInKilometers(origin: DeliveryLocation, destination: DeliveryLocation) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

export function PublicCheckoutClient({ restaurant, settings, table }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dine_in">(
    table && restaurant.acceptsDineIn
      ? "dine_in"
      : restaurant.acceptsDelivery
        ? "delivery"
        : "pickup",
  );
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    settings.acceptsMbWay
      ? "mb_way"
      : settings.acceptsTerminal
        ? "terminal"
        : "cash",
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const router = useRouter();
  const money = useMemo(
    () =>
      new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: restaurant.currencyCode,
      }),
    [restaurant.currencyCode],
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setItems(readCart(restaurant.id));
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [restaurant.id]);
  const subtotal = items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
  const restaurantLocation = settings.deliveryOriginLatitude !== null
    && settings.deliveryOriginLongitude !== null
    ? { latitude: settings.deliveryOriginLatitude, longitude: settings.deliveryOriginLongitude }
    : null;
  const deliveryDistance = restaurantLocation && deliveryLocation
    ? distanceInKilometers(restaurantLocation, deliveryLocation)
    : null;
  const outsideDeliveryRadius = deliveryDistance !== null
    && settings.deliveryRadiusKm > 0
    && deliveryDistance > settings.deliveryRadiusKm;
  const calculatedDeliveryFee = settings.defaultDeliveryFee
    + (deliveryDistance ?? 0) * settings.deliveryFeePerKm;
  const deliveryFee =
    orderType === "delivery" &&
    (settings.freeDeliveryFrom === null || subtotal < settings.freeDeliveryFrom)
      ? Math.round(calculatedDeliveryFee * 100) / 100
      : 0;
  const total = subtotal + deliveryFee;
  const minimumReached = subtotal >= settings.minimumOrderAmount;

  function save(next: CartItem[]) {
    setItems(next);
    writeCart(restaurant.id, next);
  }
  function setQuantity(id: string, quantity: number) {
    save(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  }
  function setNotes(id: string, notes: string) {
    save(items.map((item) => (item.id === id ? { ...item, notes } : item)));
  }

  function locateDelivery() {
    if (!("geolocation" in navigator)) {
      setLocationError("Este dispositivo não suporta localização.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError("Autorize a localização e tente novamente no endereço da entrega.");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || !minimumReached || outsideDeliveryRadius) return;
    if (orderType === "delivery" && restaurantLocation && !deliveryLocation) {
      setLocationError("Confirme a localização da entrega antes de continuar.");
      return;
    }
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const supabase = createClient();
    const enteredNotes = String(formData.get("orderNotes") ?? "");
    const contextualNotes = orderType === "dine_in" && table
      ? `[[TRIMOS_TABLE:${table.code}]] ${enteredNotes}`.trim()
      : enteredNotes;
    const orderRequest = {
      requested_restaurant_id: restaurant.id,
      requested_customer_name: String(formData.get("customerName") ?? ""),
      requested_customer_phone: String(formData.get("customerPhone") ?? ""),
      requested_customer_email: String(formData.get("customerEmail") ?? ""),
      requested_type: orderType,
      requested_delivery_address:
        orderType === "delivery"
          ? String(formData.get("deliveryAddress") ?? "")
          : "",
      requested_delivery_latitude: orderType === "delivery" ? deliveryLocation?.latitude ?? null : null,
      requested_delivery_longitude: orderType === "delivery" ? deliveryLocation?.longitude ?? null : null,
      requested_notes: restaurant.isDemo
        ? `${contextualNotes}${contextualNotes ? "\n" : ""}[PEDIDO DE DEMONSTRAÇÃO]`
        : contextualNotes,
      requested_items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variant?.id ?? null,
        modifiers: item.modifiers.map((modifier) => ({
          optionId: modifier.optionId,
          quantity: modifier.quantity ?? 1,
        })),
        quantity: item.quantity,
        notes: item.notes ?? "",
      })),
      requested_payment_method: paymentMethod,
      requested_cash_tendered_amount:
        paymentMethod === "cash" && String(formData.get("cashTenderedAmount") ?? "").trim()
          ? Number(formData.get("cashTenderedAmount"))
          : null,
    };
    const { data, error } = await supabase.rpc(
      "create_public_order",
      orderRequest as unknown as Database["public"]["Functions"]["create_public_order"]["Args"],
    );
    if (error || !data?.[0]) {
      setSubmitting(false);
      toast.error("Não foi possível concluir o pedido.", {
        description: error?.message,
      });
      return;
    }

    if (paymentMethod === "mb_way") {
      const response = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: data[0].order_id,
          token: data[0].order_token,
        }),
      });
      const payment = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payment.url) {
        setSubmitting(false);
        toast.error("Não foi possível iniciar o MB WAY.", {
          description: payment.error,
        });
        return;
      }
      writeCart(restaurant.id, []);
      window.location.assign(payment.url);
      return;
    }

    setSubmitting(false);
    writeCart(restaurant.id, []);
    router.push(
      `/r/${restaurant.slug}/pedido/${data[0].order_id}?token=${data[0].order_token}`,
    );
  }

  if (!loaded) return <main className="min-h-screen bg-zinc-50" />;
  if (!items.length)
    return (
      <main className="min-h-screen bg-zinc-50">
        {restaurant.isDemo ? <DemoModeBanner compact /> : null}
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center p-4">
          <Card className="w-full max-w-md text-center shadow-none">
          <CardContent className="p-10">
            <ShoppingBag className="mx-auto size-10 text-zinc-300" />
            <h1 className="mt-4 text-xl font-semibold">
              O carrinho está vazio
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Escolha produtos no menu para começar.
            </p>
            <Link
              href={`/r/${restaurant.slug}${table ? `?table=${encodeURIComponent(table.code)}` : ""}`}
              className={buttonVariants({ className: "mt-6" })}
            >
              Voltar ao menu
            </Link>
          </CardContent>
          </Card>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-zinc-50 pb-10">
      {restaurant.isDemo ? <DemoModeBanner compact /> : null}
      <form onSubmit={submit} className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href={`/r/${restaurant.slug}${table ? `?table=${encodeURIComponent(table.code)}` : ""}`}
          className={buttonVariants({
            variant: "ghost",
            className: "mb-4 gap-2",
          })}
        >
          <ArrowLeft className="size-4" /> Continuar a escolher
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {!restaurant.isOpen ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">O restaurante está fechado.</p>
                <p className="mt-1">{restaurant.operatingLabel}. Pode rever o carrinho, mas o pedido só pode ser enviado durante o horário de funcionamento.</p>
              </div>
            ) : null}
            {table ? (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950"><UtensilsCrossed className="size-5" /></span>
                <div><p className="font-semibold">Pedido para {table.name}</p><p className="text-sm">O restaurante receberá a identificação da mesa.</p></div>
              </div>
            ) : null}
            <h1 className="text-3xl font-semibold">O seu pedido</h1>
            {items.map((item) => (
              <Card key={item.id} className="shadow-none">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{item.productName}</h2>
                      {item.variant && (
                        <p className="text-sm text-zinc-500">
                          {item.variant.name}
                        </p>
                      )}
                      {item.modifiers.map((modifier) => (
                        <p
                          key={modifier.optionId}
                          className="text-sm text-zinc-500"
                        >
                          {modifier.quantity ?? 1}x {modifier.groupName}:{" "}
                          {modifier.optionName}
                          {modifier.priceDelta > 0
                            ? ` (+${money.format(modifier.priceDelta * (modifier.quantity ?? 1))})`
                            : ""}
                        </p>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        save(
                          items.filter((candidate) => candidate.id !== item.id),
                        )
                      }
                      aria-label={`Remover ${item.productName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={item.quantity === 1}
                        onClick={() => setQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-6 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <span className="font-semibold">
                      {money.format(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                  <Input
                    value={item.notes ?? ""}
                    onChange={(event) => setNotes(item.id, event.target.value)}
                    placeholder="Nota para este produto"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Dados do cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    required
                    minLength={2}
                    name="customerName"
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone</label>
                  <Input
                    required
                    minLength={6}
                    name="customerPhone"
                    type="tel"
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input name="customerEmail" type="email" className="mt-2" />
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings.acceptsMbWay && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "mb_way"}
                      onChange={() => setPaymentMethod("mb_way")}
                    />
                    <Smartphone className="size-5 text-emerald-600" />
                    <span><span className="block font-medium">MB WAY</span><span className="text-xs text-zinc-500">Pagar agora com segurança</span></span>
                  </label>
                )}
                {settings.acceptsTerminal && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "terminal"}
                      onChange={() => setPaymentMethod("terminal")}
                    />
                    <CreditCard className="size-5 text-blue-600" />
                    <span><span className="block font-medium">{orderType === "delivery" ? "Levar terminal" : orderType === "dine_in" ? "Terminal na mesa" : "Terminal no levantamento"}</span><span className="text-xs text-zinc-500">{orderType === "dine_in" ? "Pagar no restaurante" : "Cartão ou MB WAY no momento da entrega"}</span></span>
                  </label>
                )}
                {settings.acceptsCash && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                    />
                    <Banknote className="size-5 text-amber-600" />
                    <span><span className="block font-medium">Dinheiro</span><span className="text-xs text-zinc-500">Pagamento no recebimento</span></span>
                  </label>
                )}
                {paymentMethod === "cash" && (
                  <div className="space-y-2 rounded-xl bg-zinc-50 p-4">
                    <label className="text-sm font-medium" htmlFor="cashTenderedAmount">Precisa de troco para quanto?</label>
                    <Input
                      id="cashTenderedAmount"
                      name="cashTenderedAmount"
                      type="number"
                      min={total}
                      step="0.01"
                      placeholder={`Sem troco ou, por exemplo, ${Math.ceil(total / 10) * 10}`}
                    />
                    <p className="text-xs text-zinc-500">Deixe vazio se entregar o valor exato.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>{table ? "Local do pedido" : "Como deseja receber?"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {table ? (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-900">
                    <UtensilsCrossed className="size-5" /> Consumo em {table.name}
                  </div>
                ) : null}
                {!table && restaurant.acceptsDelivery && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      checked={orderType === "delivery"}
                      onChange={() => setOrderType("delivery")}
                    />{" "}
                    Entrega
                  </label>
                )}
                {!table && restaurant.acceptsPickup && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      checked={orderType === "pickup"}
                      onChange={() => setOrderType("pickup")}
                    />{" "}
                    Levantamento
                  </label>
                )}
                {orderType === "delivery" && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">
                      Morada de entrega
                    </label>
                    <Textarea
                      required
                      minLength={8}
                      name="deliveryAddress"
                      className="mt-2"
                    />
                    {restaurantLocation ? (
                      <div className="rounded-xl border border-zinc-200 p-3">
                        <p className="text-sm font-medium">Confirmar distância</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          No endereço da entrega, autorize a sua localização. Ela é usada apenas para calcular o raio e a taxa.
                        </p>
                        <Button type="button" variant="outline" className="mt-3 w-full gap-2" disabled={locating} onClick={locateDelivery}>
                          {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                          {locating ? "A calcular..." : deliveryLocation ? "Recalcular distância" : "Usar localização da entrega"}
                        </Button>
                        {deliveryDistance !== null ? (
                          <p className={`mt-3 rounded-lg p-2 text-sm ${outsideDeliveryRadius ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {outsideDeliveryRadius
                              ? `Fora do raio de ${settings.deliveryRadiusKm.toFixed(1)} km (${deliveryDistance.toFixed(2)} km).`
                              : `Distância: ${deliveryDistance.toFixed(2)} km · dentro do raio de entrega.`}
                          </p>
                        ) : null}
                        {locationError ? <p className="mt-2 text-xs text-red-600">{locationError}</p> : null}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        O restaurante ainda não ativou o cálculo automático da distância. Será aplicada a taxa base.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Observações</label>
                  <Textarea name="orderNotes" className="mt-2" />
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{money.format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Taxa de entrega</span>
                  <span>{money.format(deliveryFee)}</span>
                </div>
                {settings.freeDeliveryFrom !== null &&
                  orderType === "delivery" &&
                  deliveryFee > 0 && (
                    <p className="text-xs text-zinc-500">
                      Entrega grátis a partir de{" "}
                      {money.format(settings.freeDeliveryFrom)}.
                    </p>
                  )}
                <div className="flex justify-between border-t pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>{money.format(total)}</span>
                </div>
                {!minimumReached && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Faltam{" "}
                    {money.format(settings.minimumOrderAmount - subtotal)} para
                    atingir o pedido mínimo.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting || !minimumReached || !restaurant.isOpen || outsideDeliveryRadius || (orderType === "delivery" && Boolean(restaurantLocation) && !deliveryLocation)}
                  className="h-12 w-full bg-zinc-950"
                >
                  {submitting
                    ? "A enviar..."
                    : restaurant.isOpen
                      ? restaurant.isDemo
                        ? `Criar pedido de demonstração · ${money.format(total)}`
                        : `Confirmar pedido · ${money.format(total)}`
                      : "Restaurante fechado"}
                </Button>
                <p className="text-center text-xs text-zinc-500">
                  Tempo estimado: {settings.defaultPreparationMinutes} minutos
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </main>
  );
}
