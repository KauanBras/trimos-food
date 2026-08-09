"use client";

import { useState, useTransition } from "react";
import { Banknote, Bike, Copy, LoaderCircle, Mail, MapPin, Phone, Plus, Power, Send, Truck, UserRound, WalletCards, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelDriverInviteAction,
  createDriverInviteAction,
  setDriverActiveAction,
  settleDriverEarningsAction,
} from "@/features/drivers/actions/restaurant-driver-actions";
import type { Database } from "@/types/database";

type DriverStatus = Database["public"]["Enums"]["driver_status"];

type DriverRow = {
  id: string;
  status: DriverStatus;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  is_active: boolean;
  location_updated_at: string | null;
  is_network_enabled: boolean;
  payout_method: Database["public"]["Enums"]["driver_payout_method"];
  payout_phone: string | null;
  payout_iban: string | null;
  profiles: { full_name: string | null; avatar_url: string | null; phone: string | null } | null;
  deliveries: { id: string; status: string; delivered_at: string | null }[];
};

type EarningRow = {
  id: string;
  driver_fee: number;
  cash_collected: number;
  net_balance: number;
  status: Database["public"]["Enums"]["driver_earning_status"];
  created_at: string;
  settled_at: string | null;
  drivers: {
    id: string;
    payout_method: Database["public"]["Enums"]["driver_payout_method"];
    payout_phone: string | null;
    payout_iban: string | null;
    profiles: { full_name: string | null } | null;
  } | null;
  orders: { customer_name: string } | null;
};

type InviteRow = {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
};

const statusLabels: Record<DriverStatus, string> = {
  offline: "Offline",
  available: "Disponível",
  busy: "Em entrega",
  suspended: "Suspenso",
};

const statusClasses: Record<DriverStatus, string> = {
  offline: "border-zinc-200 bg-zinc-100 text-zinc-600",
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  busy: "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
};

export function RestaurantDriversClient({ initialDrivers, initialInvites, initialEarnings, currencyCode, initialNow }: { initialDrivers: DriverRow[]; initialInvites: InviteRow[]; initialEarnings: EarningRow[]; currencyCode: string; initialNow: string }) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [invites, setInvites] = useState(initialInvites);
  const [earnings, setEarnings] = useState(initialEarnings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function copyLink(link: string) {
    const fullLink = link.startsWith("/") ? `${window.location.origin}${link}` : link;
    void navigator.clipboard.writeText(fullLink).then(() => toast.success("Link copiado."));
  }

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    startTransition(async () => {
      const result = await createDriverInviteAction(email);
      if (!result.ok || !result.token) {
        toast.error(result.message);
        return;
      }
      const link = `${window.location.origin}/driver/invite/${result.token}`;
      setLastInviteLink(link);
      setLastInviteEmailSent(Boolean(result.emailSent));
      toast.success(result.message);
    });
  }

  function toggleDriver(driver: DriverRow) {
    startTransition(async () => {
      const result = await setDriverActiveAction(driver.id, !driver.is_active);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setDrivers((current) => current.map((item) => item.id === driver.id ? { ...item, is_active: !driver.is_active } : item));
      }
    });
  }

  function cancelInvite(inviteId: string) {
    startTransition(async () => {
      const result = await cancelDriverInviteAction(inviteId);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setInvites((current) => current.filter((item) => item.id !== inviteId));
      }
    });
  }

  function settleEarning(earning: EarningRow) {
    startTransition(async () => {
      const result = await settleDriverEarningsAction([earning.id], `Liquidação ${new Date().toLocaleDateString("pt-PT")}`);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setEarnings((current) => current.map((item) => item.id === earning.id ? { ...item, status: "settled", settled_at: new Date().toISOString() } : item));
      }
    });
  }

  const money = (value: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(value);

  const available = drivers.filter((driver) => driver.status === "available" && driver.is_active).length;
  const busy = drivers.filter((driver) => driver.status === "busy").length;
  const completed = drivers.reduce((sum, driver) => sum + driver.deliveries.filter((delivery) => delivery.status === "delivered").length, 0);
  const pendingInvites = invites.filter(
    (invite) =>
      !invite.accepted_at
      && new Date(invite.expires_at).getTime() > new Date(initialNow).getTime(),
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-sm font-medium text-amber-600">Rede de entregas</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Estafetas</h1><p className="mt-2 text-sm text-zinc-500">Frota privada, rede Trimos, disponibilidade e acertos no mesmo lugar.</p></div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setLastInviteLink(null); setLastInviteEmailSent(false); } }}>
          <DialogTrigger render={<Button className="h-11 gap-2 bg-zinc-950 hover:bg-zinc-800" />}><Plus className="size-4" /> Convidar estafeta</DialogTrigger>
          <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Convidar estafeta</DialogTitle></DialogHeader>{lastInviteLink ? <div className="space-y-4"><div className={`rounded-2xl p-4 ${lastInviteEmailSent ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><p className="font-semibold">{lastInviteEmailSent ? "Convite enviado por e-mail" : "Convite criado"}</p><p className="mt-1 text-sm">{lastInviteEmailSent ? "O estafeta recebeu o acesso individual. O link expira em sete dias e deixa de funcionar após a ativação." : "O e-mail não foi entregue. Copie e envie este link manualmente; ele expira em sete dias."}</p></div><Input value={lastInviteLink} readOnly /><Button type="button" variant={lastInviteEmailSent ? "outline" : "default"} className="w-full" onClick={() => copyLink(lastInviteLink)}><Copy className="mr-2 size-4" /> Copiar link de segurança</Button></div> : <form onSubmit={invite} className="space-y-4"><div className="space-y-2"><Label htmlFor="driverEmail">E-mail do estafeta</Label><Input id="driverEmail" name="email" type="email" placeholder="estafeta@email.pt" required /></div><p className="text-sm text-zinc-500">O sistema envia automaticamente um acesso individual. O convite expira em sete dias e só funciona para este e-mail.</p><Button type="submit" disabled={pending} className="w-full">{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Enviar convite</Button></form>}</DialogContent>
        </Dialog>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-none"><CardContent className="p-5"><p className="text-sm text-emerald-700">Disponíveis</p><p className="mt-2 text-3xl font-semibold">{available}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50 shadow-none"><CardContent className="p-5"><p className="text-sm text-amber-700">Em entrega</p><p className="mt-2 text-3xl font-semibold">{busy}</p></CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50 shadow-none"><CardContent className="p-5"><p className="text-sm text-blue-700">Entregas concluídas</p><p className="mt-2 text-3xl font-semibold">{completed}</p></CardContent></Card>
      </section>

      {pendingInvites.length > 0 && <Card className="border-violet-200 bg-violet-50/40 shadow-none"><CardHeader><CardTitle className="text-lg">Convites pendentes</CardTitle></CardHeader><CardContent className="space-y-3">{pendingInvites.map((invite) => { const link = `/driver/invite/${invite.token}`; return <div key={invite.id} className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center"><div><p className="flex items-center gap-2 font-medium"><Mail className="size-4" />{invite.email}</p><p className="mt-1 text-xs text-zinc-500">Expira em {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", timeZone: "Europe/Lisbon" }).format(new Date(invite.expires_at))}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => copyLink(link)}><Copy className="mr-1 size-4" /> Copiar</Button><Button variant="outline" size="sm" className="text-red-600" onClick={() => cancelInvite(invite.id)}><X className="mr-1 size-4" /> Cancelar</Button></div></div>; })}</CardContent></Card>}

      {!drivers.length ? <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white text-center"><Bike className="size-9 text-zinc-300" /><p className="mt-4 font-medium">Ainda não existem estafetas próprios</p><p className="mt-1 max-w-sm text-sm text-zinc-500">Pode convidar a sua frota ou ativar a rede Trimos nas configurações.</p></div> : <div className="grid gap-4 xl:grid-cols-2">{drivers.map((driver) => { const name = driver.profiles?.full_name || "Estafeta"; const phone = driver.phone || driver.profiles?.phone; const completedCount = driver.deliveries.filter((delivery) => delivery.status === "delivered").length; return <Card key={driver.id} className="border-zinc-200 shadow-none"><CardHeader><div className="flex items-start gap-4"><div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-white"><UserRound className="size-5" /></div><div className="min-w-0 flex-1"><CardTitle className="truncate text-lg">{name}</CardTitle><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusClasses[driver.status]}>{statusLabels[driver.status]}</Badge>{driver.is_network_enabled && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Rede Trimos</Badge>}{!driver.is_active && <Badge variant="outline">Acesso suspenso</Badge>}</div></div><Button variant="outline" size="sm" disabled={pending || driver.status === "busy"} onClick={() => toggleDriver(driver)}><Power className="mr-1 size-4" />{driver.is_active ? "Suspender" : "Reativar"}</Button></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-4"><div><p className="text-xs text-zinc-500">Veículo</p><p className="mt-1 flex items-center gap-1.5 font-medium"><Truck className="size-4" />{driver.vehicle_type ?? "Não indicado"}</p></div><div><p className="text-xs text-zinc-500">Concluídas</p><p className="mt-1 font-medium">{completedCount}</p></div></div>{phone && <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-zinc-600"><Phone className="size-4" />{phone}</a>}{driver.location_updated_at && <p className="flex items-center gap-2 text-xs text-zinc-400"><MapPin className="size-3.5" /> Localização atualizada às {new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(driver.location_updated_at))}</p>}</CardContent></Card>; })}</div>}

      <Card className="border-zinc-200 shadow-none">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><WalletCards className="size-5" /> Acertos dos estafetas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-emerald-700">Restaurante deve aos estafetas</p><p className="mt-2 text-2xl font-semibold text-emerald-800">{money(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, Number(item.net_balance)), 0))}</p></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm text-amber-700">Dinheiro a receber dos estafetas</p><p className="mt-2 text-2xl font-semibold text-amber-800">{money(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, -Number(item.net_balance)), 0))}</p></div>
          </div>
          {!earnings.length ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-zinc-500">Os acertos aparecerão depois das primeiras entregas concluídas.</p> : earnings.map((earning) => <div key={earning.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-200 p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{earning.drivers?.profiles?.full_name ?? "Estafeta"} · {earning.orders?.customer_name ?? "Pedido"}</p><p className="mt-1 text-sm text-zinc-500">Ganho {money(earning.driver_fee)}{Number(earning.cash_collected) > 0 ? ` · recebeu ${money(earning.cash_collected)} em dinheiro` : ""}</p><p className={`mt-1 text-sm font-medium ${Number(earning.net_balance) >= 0 ? "text-emerald-700" : "text-amber-700"}`}>{Number(earning.net_balance) >= 0 ? `Pagar ao estafeta ${money(earning.net_balance)}` : `Receber do estafeta ${money(Math.abs(earning.net_balance))}`}</p>{earning.status === "pending" && earning.drivers ? <p className="mt-1 text-xs text-zinc-500">{earning.drivers.payout_method === "mb_way" ? `MB WAY: ${earning.drivers.payout_phone ?? "não indicado"}` : earning.drivers.payout_method === "bank_transfer" ? `IBAN: ${earning.drivers.payout_iban ?? "não indicado"}` : "Acerto em dinheiro"}</p> : null}</div><div>{earning.status === "settled" ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Liquidado</Badge> : <Button type="button" size="sm" disabled={pending} onClick={() => settleEarning(earning)}>{Number(earning.net_balance) >= 0 ? <WalletCards className="mr-2 size-4" /> : <Banknote className="mr-2 size-4" />} Marcar liquidado</Button>}</div></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
