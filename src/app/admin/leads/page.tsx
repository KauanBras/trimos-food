import { Mail, MapPin, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateCommercialLeadAction } from "@/features/platform/actions/platform-actions";
import { requireSuperAdmin } from "@/lib/platform/admin";
import { formatDateTime } from "@/lib/platform/format";

const labels: Record<string, string> = {
  new: "Novo",
  contacted: "Contactado",
  qualified: "Qualificado",
  won: "Ganho",
  lost: "Perdido",
};

export default async function AdminLeadsPage() {
  const { supabase } = await requireSuperAdmin();
  const { data: leads, error } = await supabase
    .from("commercial_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">Funil comercial</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Oportunidades
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Pedidos de demonstração enviados pela página pública.
        </p>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        {(leads ?? []).map((lead) => (
          <Card key={lead.id} className="border-zinc-200 shadow-none">
            <CardHeader className="border-b border-zinc-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {lead.restaurant_name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {lead.contact_name}
                  </p>
                </div>
                <Badge variant="outline">{labels[lead.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 truncate"
                >
                  <Mail className="size-4 text-zinc-400" />
                  {lead.email}
                </a>
                <span className="flex items-center gap-2">
                  <Phone className="size-4 text-zinc-400" />
                  {lead.phone || "—"}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-zinc-400" />
                  {lead.city || "—"}
                </span>
              </div>
              {lead.message ? (
                <div className="rounded-xl bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                  {lead.message}
                </div>
              ) : null}
              <form action={updateCommercialLeadAction} className="space-y-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <select
                    name="status"
                    defaultValue={lead.status}
                    className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                  >
                    <option value="new">Novo</option>
                    <option value="contacted">Contactado</option>
                    <option value="qualified">Qualificado</option>
                    <option value="won">Ganho</option>
                    <option value="lost">Perdido</option>
                  </select>
                  <Textarea
                    name="notes"
                    defaultValue={lead.internal_notes ?? ""}
                    placeholder="Notas internas"
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    Recebido {formatDateTime(lead.created_at)}
                  </span>
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
        {(leads ?? []).length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="p-12 text-center text-zinc-500">
              Os novos pedidos de demonstração aparecerão aqui.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
