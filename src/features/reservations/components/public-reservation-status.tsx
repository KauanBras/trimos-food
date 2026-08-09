"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgePercent, CalendarCheck2, Clock3, LoaderCircle, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["reservation_status"];

const labels: Record<Status, string> = {
  pending: "A aguardar confirmação",
  confirmed: "Reserva confirmada",
  seated: "Mesa ocupada",
  completed: "Reserva concluída",
  cancelled: "Reserva cancelada",
  no_show: "Não compareceu",
};

export function PublicReservationStatus({
  reservationId,
  token,
  slug,
  initialStatus,
  customerName,
  date,
  time,
  partySize,
  tableLabel,
  discountPercent,
  discountLabel,
}: {
  reservationId: string;
  token: string;
  slug: string;
  initialStatus: Status;
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel: string | null;
  discountPercent: number | null;
  discountLabel: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [currentTableLabel, setCurrentTableLabel] = useState(tableLabel);
  const [cancelling, setCancelling] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (["completed", "cancelled", "no_show"].includes(status)) return;
    const refresh = async () => {
      const { data } = await supabase.rpc("get_public_reservation_status", {
        requested_reservation_id: reservationId,
        requested_reservation_token: token,
      });
      if (data && typeof data === "object" && "status" in data) {
        setStatus(String(data.status) as Status);
        if ("tableLabel" in data) {
          setCurrentTableLabel(
            typeof data.tableLabel === "string" ? data.tableLabel : null,
          );
        }
      }
    };
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [reservationId, status, supabase, token]);

  async function cancel() {
    setCancelling(true);
    const { data, error } = await supabase.rpc("cancel_public_reservation", {
      requested_reservation_id: reservationId,
      requested_reservation_token: token,
    });
    setCancelling(false);
    if (error || !data) {
      toast.error("Não foi possível cancelar", { description: error?.message ?? "A reserva já não pode ser cancelada." });
      return;
    }
    setStatus("cancelled");
    toast.success("Reserva cancelada.");
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl sm:p-10">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CalendarCheck2 className="size-8" /></div>
      <Badge className="mt-5" variant="outline">{labels[status]}</Badge>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Reserva de {customerName}</h1>
      <div className="mt-7 grid gap-3 rounded-2xl bg-zinc-50 p-5 text-left sm:grid-cols-3">
        <div><p className="text-xs text-zinc-500">Data</p><p className="mt-1 flex items-center gap-1.5 font-medium"><CalendarCheck2 className="size-4" />{new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`))}</p></div>
        <div><p className="text-xs text-zinc-500">Hora</p><p className="mt-1 flex items-center gap-1.5 font-medium"><Clock3 className="size-4" />{time.slice(0, 5)}</p></div>
        <div><p className="text-xs text-zinc-500">Pessoas</p><p className="mt-1 flex items-center gap-1.5 font-medium"><Users className="size-4" />{partySize}</p></div>
      </div>
      {discountPercent && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
          <BadgePercent className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-semibold text-emerald-900">{discountPercent}% de desconto incluído</p>
            <p className="mt-1 text-sm text-emerald-800">{discountLabel || "Desconto na refeição"}. Apresente esta reserva no restaurante.</p>
          </div>
        </div>
      )}
      {currentTableLabel && <p className="mt-4 text-sm text-zinc-600">Mesa atribuída: <strong>{currentTableLabel}</strong></p>}
      <p className="mt-6 text-sm leading-6 text-zinc-500">Guarde este endereço para consultar o estado da reserva.</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button render={<Link href={`/r/${slug}`} />} nativeButton={false} variant="outline">Voltar ao restaurante</Button>
        {["pending", "confirmed"].includes(status) && <Button type="button" variant="outline" className="text-red-600" disabled={cancelling} onClick={cancel}>{cancelling ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <X className="mr-2 size-4" />}Cancelar reserva</Button>}
      </div>
    </div>
  );
}
