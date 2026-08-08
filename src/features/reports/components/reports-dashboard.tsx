"use client";

import { useMemo } from "react";
import { Download, Euro, ShoppingBag, Timer, TrendingUp, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DayMetric = { date: string; label: string; revenue: number; orders: number; reservations: number };
type ProductMetric = { name: string; quantity: number; revenue: number };

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(value);
}

export function ReportsDashboard({ days, topProducts, metrics, currencyCode }: {
  days: DayMetric[];
  topProducts: ProductMetric[];
  metrics: { revenue: number; orders: number; averageTicket: number; completedRate: number; reservations: number; guests: number };
  currencyCode: string;
}) {
  const csv = useMemo(() => {
    const rows = [["Data", "Receita", "Pedidos", "Reservas"], ...days.map((day) => [day.date, day.revenue.toFixed(2), String(day.orders), String(day.reservations)])];
    return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  }, [days]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `trimos-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const cards = [
    { label: "Receita", value: money(metrics.revenue, currencyCode), icon: Euro, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Pedidos", value: String(metrics.orders), icon: ShoppingBag, tone: "bg-blue-50 text-blue-700" },
    { label: "Ticket médio", value: money(metrics.averageTicket, currencyCode), icon: TrendingUp, tone: "bg-amber-50 text-amber-700" },
    { label: "Taxa de conclusão", value: `${metrics.completedRate.toFixed(0)}%`, icon: Timer, tone: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button variant="outline" className="gap-2" onClick={downloadCsv}><Download className="size-4" /> Exportar CSV</Button></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => { const Icon = item.icon; return <Card key={item.label} className="border-zinc-200 shadow-none"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-zinc-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p></div><div className={`rounded-2xl p-3 ${item.tone}`}><Icon className="size-5" /></div></CardContent></Card>; })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="border-zinc-200 shadow-none"><CardHeader><CardTitle className="text-lg">Receita e pedidos</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7"/><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12}/><YAxis tickLine={false} axisLine={false} fontSize={12}/><Tooltip formatter={(value) => money(Number(value), currencyCode)}/><Area type="monotone" dataKey="revenue" name="Receita" stroke="#f59e0b" fill="url(#revenueFill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></CardContent></Card>
        <Card className="border-zinc-200 shadow-none"><CardHeader><CardTitle className="text-lg">Reservas</CardTitle></CardHeader><CardContent><div className="rounded-3xl bg-zinc-950 p-6 text-white"><Users className="size-6 text-amber-400" /><p className="mt-6 text-sm text-zinc-400">Reservas no período</p><p className="mt-1 text-4xl font-semibold">{metrics.reservations}</p><p className="mt-5 text-sm text-zinc-400">{metrics.guests} pessoas previstas</p></div><div className="mt-5 h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={days}><XAxis dataKey="label" hide/><YAxis hide/><Tooltip/><Bar dataKey="reservations" name="Reservas" fill="#18181b" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></CardContent></Card>
      </section>

      <Card className="border-zinc-200 shadow-none"><CardHeader><CardTitle className="text-lg">Produtos mais vendidos</CardTitle></CardHeader><CardContent>{topProducts.length ? <div className="space-y-4">{topProducts.slice(0, 8).map((product, index) => <div key={product.name} className="flex items-center gap-4"><div className="flex size-9 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-4"><p className="truncate font-medium">{product.name}</p><p className="font-semibold">{money(product.revenue, currencyCode)}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(6, (product.quantity / Math.max(...topProducts.map((item) => item.quantity))) * 100)}%` }} /></div><p className="mt-1 text-xs text-zinc-500">{product.quantity} unidades</p></div></div>)}</div> : <p className="py-12 text-center text-zinc-500">Ainda não existem vendas neste período.</p>}</CardContent></Card>
    </div>
  );
}
