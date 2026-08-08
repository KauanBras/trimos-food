"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, LocateFixed, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readCart, type CartItem, writeCart } from "@/features/cart/types";
import { createClient } from "@/lib/supabase/client";

type Props = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currencyCode: string;
    acceptsDelivery: boolean;
    acceptsPickup: boolean;
    isOpen: boolean;
    operatingLabel: string;
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
  };
};

type DeliveryLocation = { latitude: number; longitude: number };

function distanceInKilometers(origin: DeliveryLocation, destination: DeliveryLocation) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

export function PublicCheckoutClient({ restaurant, settings }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">(
    restaurant.acceptsDelivery ? "delivery" : "pickup",
  );
  const [submitting, setSubmitting] = useState(false);
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
    const { data, error } = await supabase.rpc("create_public_order", {
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
      requested_notes: String(formData.get("orderNotes") ?? ""),
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
    });
    setSubmitting(false);
    if (error || !data?.[0]) {
      toast.error("Não foi possível concluir o pedido.", {
        description: error?.message,
      });
      return;
    }
    writeCart(restaurant.id, []);
    router.push(
      `/r/${restaurant.slug}/pedido/${data[0].order_id}?token=${data[0].order_token}`,
    );
  }

  if (!loaded) return <main className="min-h-screen bg-zinc-50" />;
  if (!items.length)
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
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
              href={`/r/${restaurant.slug}`}
              className={buttonVariants({ className: "mt-6" })}
            >
              Voltar ao menu
            </Link>
          </CardContent>
        </Card>
      </main>
    );

  return (
    <main className="min-h-screen bg-zinc-50 pb-10">
      <form onSubmit={submit} className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href={`/r/${restaurant.slug}`}
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
                <CardTitle>Como deseja receber?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {restaurant.acceptsDelivery && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4">
                    <input
                      type="radio"
                      checked={orderType === "delivery"}
                      onChange={() => setOrderType("delivery")}
                    />{" "}
                    Entrega
                  </label>
                )}
                {restaurant.acceptsPickup && (
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
                      ? `Confirmar pedido · ${money.format(total)}`
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
