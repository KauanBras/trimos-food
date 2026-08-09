"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, LoaderCircle, PackageCheck, Truck, XCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

export type PublicOrderSummary = {
  id: string;
  customerName: string;
  status: string;
  type: string;
  tableLabel: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  estimatedMinutes: number | null;
  paymentMethod: "cash" | "terminal" | "mb_way";
  paymentStatus: "pending" | "awaiting_collection" | "paid" | "failed" | "refunded" | "cancelled";
  cashTenderedAmount: number | null;
  items: Array<{
    productName: string;
    variantName: string | null;
    modifiers: Array<{ group: string; option: string; priceDelta: number; quantity?: number }>;
    quantity: number;
    unitPrice: number;
    notes: string | null;
  }>;
};

const statusCopy: Record<string, { title: string; description: string; tone: string }> = {
  pending_payment: { title: "A aguardar pagamento", description: "Confirme o pedido na aplicação MB WAY.", tone: "bg-violet-50 text-violet-900" },
  new: { title: "Pedido recebido", description: "A aguardar aceitação do restaurante.", tone: "bg-amber-50 text-amber-900" },
  confirmed: { title: "Pedido aceite", description: "A equipa confirmou o seu pedido.", tone: "bg-blue-50 text-blue-900" },
  preparing: { title: "Em preparação", description: "A cozinha já está a preparar o pedido.", tone: "bg-amber-50 text-amber-900" },
  ready: { title: "Pedido pronto", description: "O pedido está pronto para sair.", tone: "bg-emerald-50 text-emerald-900" },
  awaiting_driver: { title: "A procurar estafeta", description: "O restaurante está a atribuir a entrega.", tone: "bg-violet-50 text-violet-900" },
  out_for_delivery: { title: "A caminho", description: "O estafeta recolheu o pedido e segue para a morada.", tone: "bg-blue-50 text-blue-900" },
  completed: { title: "Pedido concluído", description: "Obrigado por escolher este restaurante.", tone: "bg-emerald-50 text-emerald-900" },
  cancelled: { title: "Pedido cancelado", description: "Contacte o restaurante se precisar de ajuda.", tone: "bg-red-50 text-red-800" },
};

export function PublicOrderStatus({
  initialOrder,
  token,
  slug,
  currencyCode,
}: {
  initialOrder: PublicOrderSummary;
  token: string;
  slug: string;
  currencyCode: string;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [startingPayment, setStartingPayment] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const money = useMemo(
    () => new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }),
    [currencyCode],
  );
  const copy = statusCopy[order.status] ?? statusCopy.new;

  async function retryMbWay() {
    setStartingPayment(true);
    const response = await fetch("/api/payments/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: order.id, token }),
    });
    const result = (await response.json()) as { url?: string };
    if (response.ok && result.url) {
      window.location.assign(result.url);
      return;
    }
    setStartingPayment(false);
  }

  useEffect(() => {
    if (["completed", "cancelled"].includes(order.status)) return;
    const refresh = async () => {
      const { data } = await supabase.rpc("get_public_order_status", {
        requested_order_id: order.id,
        requested_order_token: token,
      });
      if (data) setOrder(data as Json as PublicOrderSummary);
    };
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [order.id, order.status, supabase, token]);

  const StatusIcon = order.status === "cancelled" ? XCircle : order.status === "out_for_delivery" ? Truck : ["ready", "completed"].includes(order.status) ? PackageCheck : ["new", "pending_payment"].includes(order.status) ? LoaderCircle : CheckCircle2;

  return (
    <main className="min-h-screen bg-zinc-50 p-4 py-10">
      <Card className="mx-auto max-w-2xl shadow-none">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center">
            <StatusIcon className={`mx-auto size-14 ${["new", "pending_payment"].includes(order.status) ? "animate-pulse text-amber-500" : order.status === "cancelled" ? "text-red-500" : "text-emerald-500"}`} />
            <h1 className="mt-4 text-3xl font-semibold">{copy.title}</h1>
            <p className="mt-2 text-zinc-500">{copy.description}</p>
            <p className="mt-3 font-mono text-sm">#{order.id.slice(0, 6).toUpperCase()}</p>
          </div>

          <div className={`flex items-center justify-center gap-2 rounded-2xl p-4 ${copy.tone}`}>
            <Clock3 className="size-5" /> Tempo estimado: {order.estimatedMinutes ?? 30} minutos
          </div>

          {order.tableLabel ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center font-semibold text-amber-900">
              Pedido identificado para {order.tableLabel}
            </div>
          ) : null}

          <div className="rounded-2xl border p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-500">Pagamento</span>
              <span className="font-medium">
                {order.paymentMethod === "mb_way" ? "MB WAY" : order.paymentMethod === "terminal" ? "Terminal" : "Dinheiro"}
                {order.paymentStatus === "paid" ? " · Pago" : order.paymentStatus === "awaiting_collection" ? " · No recebimento" : " · Pendente"}
              </span>
            </div>
            {order.paymentMethod === "cash" && order.cashTenderedAmount !== null ? (
              <p className="mt-2 text-zinc-600">
                Troco para {money.format(order.cashTenderedAmount)}: {money.format(Math.max(0, order.cashTenderedAmount - order.total))}
              </p>
            ) : null}
            {order.status === "pending_payment" ? (
              <Button type="button" className="mt-4 w-full" disabled={startingPayment} onClick={() => void retryMbWay()}>
                {startingPayment ? "A abrir MB WAY..." : "Continuar pagamento MB WAY"}
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={`${item.productName}-${index}`} className="rounded-xl border p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.quantity}x {item.productName}</p>
                    {item.variantName ? <p className="text-sm text-zinc-500">{item.variantName}</p> : null}
                    {item.modifiers.map((modifier, modifierIndex) => (
                      <p key={`${modifier.option}-${modifierIndex}`} className="text-sm text-zinc-500">{modifier.quantity ?? 1}x {modifier.group}: {modifier.option}</p>
                    ))}
                    {item.notes ? <p className="mt-1 text-sm text-amber-700">Nota: {item.notes}</p> : null}
                  </div>
                  <span className="font-medium">{money.format(item.unitPrice * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money.format(order.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span>Entrega</span><span>{money.format(order.deliveryFee)}</span></div>
            <div className="flex justify-between text-xl font-semibold"><span>Total</span><span>{money.format(order.total)}</span></div>
          </div>

          <div className="text-center">
            <Link href={`/r/${slug}`} className={buttonVariants({ variant: "outline" })}>Voltar ao menu</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
