"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Banknote, Bike, CheckCircle2, Copy, Landmark, LoaderCircle, Mail, MapPin, Phone, Plus, Power, ReceiptText, Send, Truck, UserRound, WalletCards, X } from "lucide-react";
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
  settlement_reference: string | null;
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

type SettlementGroup = {
  driverId: string;
  driverName: string;
  payoutMethod: Database["public"]["Enums"]["driver_payout_method"];
  payoutPhone: string | null;
  payoutIban: string | null;
  earningIds: string[];
  deliveryCount: number;
  driverFees: number;
  cashCollected: number;
  netBalance: number;
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
  const [settlementGroup, setSettlementGroup] = useState<SettlementGroup | null>(null);
  const [settlementReference, setSettlementReference] = useState("");
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

  function settleGroup() {
    if (!settlementGroup) return;
    startTransition(async () => {
      const result = await settleDriverEarningsAction(settlementGroup.earningIds, settlementReference);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        const settledAt = new Date().toISOString();
        const settledIds = new Set(settlementGroup.earningIds);
        setEarnings((current) => current.map((item) => settledIds.has(item.id) ? { ...item, status: "settled", settled_at: settledAt, settlement_reference: settlementReference.trim() } : item));
        setSettlementGroup(null);
        setSettlementReference("");
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
  const pendingSettlementGroups = Object.values(
    earnings
      .filter((earning) => earning.status === "pending" && earning.drivers)
      .reduce<Record<string, SettlementGroup>>((groups, earning) => {
        const driver = earning.drivers!;
        const current = groups[driver.id] ?? {
          driverId: driver.id,
          driverName: driver.profiles?.full_name ?? "Estafeta",
          payoutMethod: driver.payout_method,
          payoutPhone: driver.payout_phone,
          payoutIban: driver.payout_iban,
          earningIds: [],
          deliveryCount: 0,
          driverFees: 0,
          cashCollected: 0,
          netBalance: 0,
        };
        current.earningIds.push(earning.id);
        current.deliveryCount += 1;
        current.driverFees += Number(earning.driver_fee);
        current.cashCollected += Number(earning.cash_collected);
        current.netBalance += Number(earning.net_balance);
        groups[driver.id] = current;
        return groups;
      }, {}),
  );

  function payoutMethodLabel(method: SettlementGroup["payoutMethod"]) {
    if (method === "mb_way") return "MB WAY";
    if (method === "bank_transfer") return "Transferência bancária";
    return "Dinheiro";
  }

  function payoutDestination(group: SettlementGroup) {
    if (group.payoutMethod === "mb_way") return group.payoutPhone;
    if (group.payoutMethod === "bank_transfer") return group.payoutIban;
    return null;
  }

  function openSettlement(group: SettlementGroup) {
    const direction = group.netBalance >= 0 ? "Pagamento" : "Recebimento";
    setSettlementReference(`${direction} ${payoutMethodLabel(group.payoutMethod)} · ${new Date().toLocaleDateString("pt-PT")}`);
    setSettlementGroup(group);
  }

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
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><WalletCards className="size-5" /> Pagamentos dos estafetas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Como funciona o recebimento</p>
            <p className="mt-1 leading-6 text-blue-800">O Trimos calcula cada entrega. Nos pedidos pagos online, o restaurante paga o ganho do estafeta pelo método indicado. Nos pedidos em dinheiro, o estafeta conserva o seu ganho e entrega ao restaurante apenas o restante. A confirmação abaixo guarda o comprovativo no histórico dos dois.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-emerald-700">Restaurante deve aos estafetas</p><p className="mt-2 text-2xl font-semibold text-emerald-800">{money(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, Number(item.net_balance)), 0))}</p></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm text-amber-700">Dinheiro a receber dos estafetas</p><p className="mt-2 text-2xl font-semibold text-amber-800">{money(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, -Number(item.net_balance)), 0))}</p></div>
          </div>
          {!earnings.length ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-zinc-500">Os acertos aparecerão depois das primeiras entregas concluídas.</p> : pendingSettlementGroups.length ? <div className="space-y-3"><p className="text-sm font-semibold text-zinc-900">Acertos pendentes</p>{pendingSettlementGroups.map((group) => { const destination = payoutDestination(group); return <div key={group.driverId} className="rounded-2xl border border-zinc-200 p-4"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold">{group.driverName}</p><Badge variant="outline">{group.deliveryCount} {group.deliveryCount === 1 ? "entrega" : "entregas"}</Badge></div><p className="mt-2 text-sm text-zinc-500">Ganhos {money(group.driverFees)}{group.cashCollected > 0 ? ` · recebeu ${money(group.cashCollected)} dos clientes` : ""}</p><p className={`mt-1 font-semibold ${group.netBalance >= 0 ? "text-emerald-700" : "text-amber-700"}`}>{group.netBalance > 0 ? `Restaurante paga ${money(group.netBalance)}` : group.netBalance < 0 ? `Estafeta entrega ${money(Math.abs(group.netBalance))}` : "Saldo compensado: não há dinheiro a transferir"}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">{group.payoutMethod === "bank_transfer" ? <Landmark className="size-3.5" /> : <Banknote className="size-3.5" />}<span>{payoutMethodLabel(group.payoutMethod)}{destination ? ` · ${destination}` : ""}</span>{destination ? <button type="button" className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline" onClick={() => copyLink(destination)}><Copy className="size-3" /> Copiar</button> : null}</div>{group.netBalance > 0 && !destination && group.payoutMethod !== "cash" ? <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="size-3.5" /> O estafeta ainda não indicou os dados de recebimento.</p> : null}</div><Button type="button" disabled={pending} className={group.netBalance < 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-zinc-950 hover:bg-zinc-800"} onClick={() => openSettlement(group)}>{group.netBalance > 0 ? <WalletCards className="mr-2 size-4" /> : <ReceiptText className="mr-2 size-4" />}{group.netBalance > 0 ? "Confirmar pagamento" : group.netBalance < 0 ? "Confirmar recebimento" : "Fechar acerto"}</Button></div></div>; })}</div> : <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="size-5" /><div><p className="font-semibold">Nenhum acerto pendente</p><p className="text-sm">Os pagamentos e valores em dinheiro estão regularizados.</p></div></div>}

          {earnings.some((earning) => earning.status === "settled") ? <div className="space-y-3 pt-2"><p className="text-sm font-semibold text-zinc-900">Histórico recente</p>{earnings.filter((earning) => earning.status === "settled").slice(0, 10).map((earning) => <div key={earning.id} className="flex flex-col justify-between gap-2 rounded-2xl bg-zinc-50 p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{earning.drivers?.profiles?.full_name ?? "Estafeta"} · {earning.orders?.customer_name ?? "Pedido"}</p><p className="mt-1 text-sm text-zinc-500">Ganho {money(earning.driver_fee)} · {Number(earning.net_balance) >= 0 ? `pago ${money(earning.net_balance)}` : `recebido ${money(Math.abs(earning.net_balance))}`}</p>{earning.settlement_reference ? <p className="mt-1 text-xs text-zinc-400">{earning.settlement_reference}</p> : null}</div><Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">Liquidado</Badge></div>)}</div> : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(settlementGroup)} onOpenChange={(open) => { if (!open && !pending) { setSettlementGroup(null); setSettlementReference(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{settlementGroup?.netBalance && settlementGroup.netBalance < 0 ? "Confirmar valor recebido" : "Confirmar pagamento ao estafeta"}</DialogTitle></DialogHeader>
          {settlementGroup ? <div className="space-y-4"><div className={`rounded-2xl p-4 ${settlementGroup.netBalance < 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}><p className="text-sm">{settlementGroup.driverName}</p><p className="mt-1 text-2xl font-semibold">{money(Math.abs(settlementGroup.netBalance))}</p><p className="mt-1 text-sm">{settlementGroup.netBalance > 0 ? `Pague por ${payoutMethodLabel(settlementGroup.payoutMethod)} e confirme apenas depois de concluir.` : settlementGroup.netBalance < 0 ? "Confirme apenas depois de receber o valor do estafeta." : "Os valores recebidos e os ganhos ficaram totalmente compensados."}</p></div><div className="space-y-2"><Label htmlFor="settlementReference">Referência ou observação do acerto</Label><Input id="settlementReference" value={settlementReference} onChange={(event) => setSettlementReference(event.target.value)} placeholder="Ex.: MB WAY 13/08/2026" maxLength={160} /><p className="text-xs text-zinc-500">Esta informação ficará visível no histórico do restaurante e do estafeta.</p></div><Button type="button" className="w-full" disabled={pending || !settlementReference.trim()} onClick={settleGroup}>{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />} Confirmar e guardar no histórico</Button></div> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
