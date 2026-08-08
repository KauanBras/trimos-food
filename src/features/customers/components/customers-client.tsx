"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, CalendarDays, Mail, Phone, Search, ShoppingBag, Star, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerAction } from "@/features/customers/actions/customer-actions";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  is_blocked: boolean;
  created_at: string;
  orders: { id: string; total: number; status: string; type: string; created_at: string }[];
  reservations: { id: string; status: string; reservation_date: string; party_size: number }[];
};

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(value);
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function CustomersClient({ initialCustomers, currencyCode }: { initialCustomers: CustomerRow[]; currencyCode: string }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const customerStats = useMemo(() => customers.map((customer) => {
    const validOrders = customer.orders.filter((order) => order.status !== "cancelled");
    const totalSpent = validOrders.reduce((sum, order) => sum + order.total, 0);
    const lastOrder = [...validOrders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { ...customer, orderCount: validOrders.length, totalSpent, lastOrderAt: lastOrder?.created_at ?? null };
  }), [customers]);

  const filtered = customerStats.filter((customer) => {
    const term = search.toLowerCase();
    return customer.name.toLowerCase().includes(term) || (customer.phone ?? "").includes(term) || (customer.email ?? "").toLowerCase().includes(term) || customer.tags.some((tag) => tag.toLowerCase().includes(term));
  });

  const returning = customerStats.filter((customer) => customer.orderCount > 1).length;
  const revenue = customerStats.reduce((sum, customer) => sum + customer.totalSpent, 0);

  function saveCustomer(customer: CustomerRow, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      tags: String(formData.get("tags") ?? "").split(","),
      isBlocked: formData.get("isBlocked") === "on",
    };
    startTransition(async () => {
      const result = await updateCustomerAction(customer.id, values);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, name: values.name.trim(), phone: values.phone.trim() || null, email: values.email.trim() || null, notes: values.notes.trim() || null, tags: values.tags.map((tag) => tag.trim()).filter(Boolean), is_blocked: values.isBlocked } : item));
      }
    });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-sm font-medium text-amber-600">CRM integrado</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Clientes</h1><p className="mt-2 text-sm text-zinc-500">Histórico de pedidos e reservas, preferências e segmentação.</p></div>
        <div className="relative sm:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, e-mail ou etiqueta" className="h-11 bg-white pl-10" /></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-200 shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-zinc-500">Clientes</p><p className="mt-2 text-3xl font-semibold">{customers.length}</p></div><Users className="size-6 text-zinc-400" /></div></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-emerald-700">Recorrentes</p><p className="mt-2 text-3xl font-semibold">{returning}</p></div><Star className="size-6 text-emerald-500" /></div></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50 shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-amber-700">Receita associada</p><p className="mt-2 text-3xl font-semibold">{money(revenue, currencyCode)}</p></div><ShoppingBag className="size-6 text-amber-500" /></div></CardContent></Card>
      </section>

      {!filtered.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white text-center"><UserRound className="size-9 text-zinc-300" /><p className="mt-4 font-medium">Nenhum cliente encontrado</p><p className="mt-1 text-sm text-zinc-500">Os clientes são criados automaticamente pelos pedidos e reservas.</p></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((customer) => (
            <Card key={customer.id} className={`border-zinc-200 shadow-none ${customer.is_blocked ? "bg-red-50/40" : ""}`}>
              <CardHeader className="pb-4"><div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-semibold text-white">{initials(customer.name)}</div><div className="min-w-0 flex-1"><CardTitle className="truncate text-lg">{customer.name}</CardTitle><div className="mt-2 flex flex-wrap gap-2">{customer.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}{customer.is_blocked && <Badge className="bg-red-600 text-white"><Ban className="mr-1 size-3" /> Bloqueado</Badge>}</div></div><Dialog><DialogTrigger render={<Button variant="outline" size="sm" />}>Editar</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader><form onSubmit={(event) => saveCustomer(customer, event)} className="space-y-4"><div className="space-y-2"><Label>Nome</Label><Input name="name" defaultValue={customer.name} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Telefone</Label><Input name="phone" defaultValue={customer.phone ?? ""} /></div><div className="space-y-2"><Label>E-mail</Label><Input name="email" type="email" defaultValue={customer.email ?? ""} /></div></div><div className="space-y-2"><Label>Etiquetas separadas por vírgula</Label><Input name="tags" defaultValue={customer.tags.join(", ")} placeholder="VIP, vegetariano, empresa" /></div><div className="space-y-2"><Label>Notas internas</Label><Textarea name="notes" defaultValue={customer.notes ?? ""} /></div><label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">Bloquear novos pedidos manuais</span><Switch name="isBlocked" defaultChecked={customer.is_blocked} /></label><Button type="submit" disabled={pending} className="w-full">Guardar cliente</Button></form></DialogContent></Dialog></div></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600">{customer.phone && <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5"><Phone className="size-4" />{customer.phone}</a>}{customer.email && <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5"><Mail className="size-4" />{customer.email}</a>}</div>
                <div className="grid grid-cols-3 gap-3 rounded-2xl bg-zinc-50 p-4 text-center"><div><p className="text-xs text-zinc-500">Pedidos</p><p className="mt-1 font-semibold">{customer.orderCount}</p></div><div><p className="text-xs text-zinc-500">Reservas</p><p className="mt-1 font-semibold">{customer.reservations.length}</p></div><div><p className="text-xs text-zinc-500">Total</p><p className="mt-1 font-semibold">{money(customer.totalSpent, currencyCode)}</p></div></div>
                {customer.notes && <p className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-600">{customer.notes}</p>}
                {customer.lastOrderAt && <p className="flex items-center gap-1.5 text-xs text-zinc-400"><CalendarDays className="size-3.5" /> Último pedido em {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(customer.lastOrderAt))}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
