"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarCheck2,
  BadgePercent,
  Check,
  Clock3,
  LoaderCircle,
  Mail,
  Phone,
  Plus,
  Search,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createReservationAction,
  updateReservationDetailsAction,
  updateReservationStatusAction,
} from "@/features/reservations/actions/reservation-actions";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export type ReservationRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  table_label: string | null;
  status: ReservationStatus;
  source: Database["public"]["Enums"]["reservation_source"];
  special_requests: string | null;
  internal_notes: string | null;
  discount_percent: number | null;
  discount_label: string | null;
  created_at: string;
};

const statusInfo: Record<ReservationStatus, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border-amber-200 bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmada", className: "border-blue-200 bg-blue-50 text-blue-700" },
  seated: { label: "Na mesa", className: "border-violet-200 bg-violet-50 text-violet-700" },
  completed: { label: "Concluída", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "border-zinc-200 bg-zinc-100 text-zinc-500" },
  no_show: { label: "Não compareceu", className: "border-red-200 bg-red-50 text-red-700" },
};

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function ReservationsClient({
  restaurantId,
  initialReservations,
}: {
  restaurantId: string;
  initialReservations: ReservationRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [reservations, setReservations] = useState(initialReservations);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = todayIso();

  const fetchReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id, customer_name, customer_phone, customer_email, reservation_date, reservation_time, party_size, table_label, status, source, special_requests, internal_notes, discount_percent, discount_label, created_at")
      .eq("restaurant_id", restaurantId)
      .order("reservation_date")
      .order("reservation_time");

    if (!error) setReservations((data ?? []) as ReservationRow[]);
  }, [restaurantId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`reservations-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` }, () => {
        void fetchReservations();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchReservations, restaurantId, supabase]);

  const filtered = reservations.filter((reservation) => {
    const term = search.toLowerCase();
    return reservation.customer_name.toLowerCase().includes(term) || reservation.customer_phone.includes(term) || (reservation.table_label ?? "").toLowerCase().includes(term);
  });

  const todayReservations = filtered.filter((item) => item.reservation_date === today);
  const upcomingReservations = filtered.filter((item) => item.reservation_date > today && !["cancelled", "completed", "no_show"].includes(item.status));
  const historyReservations = filtered.filter((item) => item.reservation_date < today || ["cancelled", "completed", "no_show"].includes(item.status));

  function createReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createReservationAction(formData);
      if (!result.ok) {
        toast.error("Não foi possível criar a reserva", { description: result.message });
        return;
      }
      toast.success(result.message);
      setDialogOpen(false);
      await fetchReservations();
    });
  }

  function changeStatus(id: string, status: ReservationStatus) {
    startTransition(async () => {
      const result = await updateReservationStatusAction(id, status);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        setReservations((current) => current.map((item) => item.id === id ? { ...item, status } : item));
      }
    });
  }

  function saveDetails(id: string, tableLabel: string, internalNotes: string) {
    startTransition(async () => {
      const result = await updateReservationDetailsAction(id, tableLabel, internalNotes);
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
    });
  }

  function renderList(items: ReservationRow[]) {
    if (!items.length) {
      return (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white text-center">
          <CalendarCheck2 className="size-8 text-zinc-300" />
          <p className="mt-4 font-medium">Nenhuma reserva nesta lista</p>
          <p className="mt-1 text-sm text-zinc-500">As novas reservas aparecerão automaticamente.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((reservation) => {
          const info = statusInfo[reservation.status];
          return (
            <Card key={reservation.id} className="overflow-hidden border-zinc-200 shadow-none transition hover:shadow-md">
              <CardHeader className="border-b border-zinc-100 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{reservation.customer_name}</CardTitle>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
                      <span className="flex items-center gap-1.5"><Clock3 className="size-4" /> {formatDate(reservation.reservation_date)} · {reservation.reservation_time.slice(0, 5)}</span>
                      <span className="flex items-center gap-1.5"><Users className="size-4" /> {reservation.party_size} pessoas</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={info.className}>{info.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600">
                  <a href={`tel:${reservation.customer_phone}`} className="flex items-center gap-1.5 hover:text-zinc-950"><Phone className="size-4" /> {reservation.customer_phone}</a>
                  {reservation.customer_email && <a href={`mailto:${reservation.customer_email}`} className="flex items-center gap-1.5 hover:text-zinc-950"><Mail className="size-4" /> {reservation.customer_email}</a>}
                </div>

                {reservation.special_requests && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Pedido especial: {reservation.special_requests}</div>}

                {reservation.discount_percent && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <BadgePercent className="mt-0.5 size-4 shrink-0" />
                    <div><strong>Aplicar {reservation.discount_percent}% de desconto</strong><p className="mt-0.5">{reservation.discount_label || "Desconto na refeição"}</p></div>
                  </div>
                )}

                <details className="rounded-xl border border-zinc-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Mesa e notas internas</summary>
                  <div className="mt-3 space-y-3">
                    <Input id={`table-${reservation.id}`} defaultValue={reservation.table_label ?? ""} placeholder="Ex.: Mesa 7" />
                    <Textarea id={`notes-${reservation.id}`} defaultValue={reservation.internal_notes ?? ""} placeholder="Notas apenas para a equipa" />
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      const table = (document.getElementById(`table-${reservation.id}`) as HTMLInputElement | null)?.value ?? "";
                      const notes = (document.getElementById(`notes-${reservation.id}`) as HTMLTextAreaElement | null)?.value ?? "";
                      saveDetails(reservation.id, table, notes);
                    }}>Guardar detalhes</Button>
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  {reservation.status === "pending" && <Button size="sm" onClick={() => changeStatus(reservation.id, "confirmed")}><Check className="mr-1 size-4" /> Confirmar</Button>}
                  {reservation.status === "confirmed" && <Button size="sm" onClick={() => changeStatus(reservation.id, "seated")}><UtensilsCrossed className="mr-1 size-4" /> Sentar à mesa</Button>}
                  {reservation.status === "seated" && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => changeStatus(reservation.id, "completed")}><Check className="mr-1 size-4" /> Concluir</Button>}
                  {["pending", "confirmed"].includes(reservation.status) && <>
                    <Button size="sm" variant="outline" onClick={() => changeStatus(reservation.id, "no_show")}>Não compareceu</Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => changeStatus(reservation.id, "cancelled")}><X className="mr-1 size-4" /> Cancelar</Button>
                  </>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-amber-600">Agenda do restaurante</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-2 text-sm text-zinc-500">Gerencie confirmações, mesas, pedidos especiais e comparecimentos.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, telefone ou mesa" className="h-11 bg-white pl-10" />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="h-11 gap-2 bg-zinc-950 hover:bg-zinc-800" />}><Plus className="size-4" /> Nova reserva</DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>
              <form onSubmit={createReservation} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="customerName">Nome do cliente</Label><Input id="customerName" name="customerName" required /></div>
                <div className="space-y-2"><Label htmlFor="customerPhone">Telefone</Label><Input id="customerPhone" name="customerPhone" required /></div>
                <div className="space-y-2"><Label htmlFor="customerEmail">E-mail</Label><Input id="customerEmail" name="customerEmail" type="email" /></div>
                <div className="space-y-2"><Label htmlFor="reservationDate">Data</Label><Input id="reservationDate" name="reservationDate" type="date" min={today} required /></div>
                <div className="space-y-2"><Label htmlFor="reservationTime">Hora</Label><Input id="reservationTime" name="reservationTime" type="time" required /></div>
                <div className="space-y-2"><Label htmlFor="partySize">Pessoas</Label><Input id="partySize" name="partySize" type="number" min="1" max="50" defaultValue="2" required /></div>
                <div className="space-y-2"><Label htmlFor="tableLabel">Mesa</Label><Input id="tableLabel" name="tableLabel" placeholder="Ex.: Mesa 4" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="specialRequests">Pedidos especiais</Label><Textarea id="specialRequests" name="specialRequests" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="internalNotes">Notas internas</Label><Textarea id="internalNotes" name="internalNotes" /></div>
                <Button type="submit" disabled={pending} className="sm:col-span-2">{pending && <LoaderCircle className="mr-2 size-4 animate-spin" />} Criar e confirmar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-blue-200 bg-blue-50/60 shadow-none"><CardContent className="p-5"><p className="text-sm font-medium text-blue-700">Hoje</p><p className="mt-2 text-3xl font-semibold">{todayReservations.length}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/60 shadow-none"><CardContent className="p-5"><p className="text-sm font-medium text-amber-700">Pendentes</p><p className="mt-2 text-3xl font-semibold">{reservations.filter((item) => item.status === "pending").length}</p></CardContent></Card>
        <Card className="border-violet-200 bg-violet-50/60 shadow-none"><CardContent className="p-5"><p className="text-sm font-medium text-violet-700">Pessoas hoje</p><p className="mt-2 text-3xl font-semibold">{todayReservations.filter((item) => !["cancelled", "no_show"].includes(item.status)).reduce((sum, item) => sum + item.party_size, 0)}</p></CardContent></Card>
      </section>

      <Tabs defaultValue="today">
        <TabsList><TabsTrigger value="today">Hoje</TabsTrigger><TabsTrigger value="upcoming">Próximas</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList>
        <TabsContent value="today" className="mt-5">{renderList(todayReservations)}</TabsContent>
        <TabsContent value="upcoming" className="mt-5">{renderList(upcomingReservations)}</TabsContent>
        <TabsContent value="history" className="mt-5">{renderList(historyReservations)}</TabsContent>
      </Tabs>
    </div>
  );
}
