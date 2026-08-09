"use client";

import { FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, LoaderCircle, Plus, Printer, QrCode, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTablesAction,
  deleteTableAction,
  regenerateTableCodeAction,
  setTableActiveAction,
} from "@/features/tables/actions/table-actions";

type TableQr = {
  id: string;
  name: string;
  code: string;
  seats: number;
  sort_order: number;
  is_active: boolean;
  menuUrl: string;
  qrDataUrl: string;
};

export function TableQrManager({ restaurantName, tables }: { restaurantName: string; tables: TableQr[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createTablesAction(
        String(form.get("prefix") ?? "Mesa"),
        Number(form.get("quantity") ?? 1),
        Number(form.get("seats") ?? 2),
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      if (result.ok) router.refresh();
    });
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      if (result.ok) router.refresh();
    });
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value).then(() => toast.success("Link copiado."));
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-amber-600">Menu nas mesas</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">QR Codes</h1>
          <p className="mt-2 text-sm text-zinc-500">Cada mesa recebe um código próprio. Os pedidos entram identificados no painel e na cozinha.</p>
        </div>
        {tables.length ? <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="size-4" /> Imprimir todos</Button> : null}
      </section>

      <Card className="border-amber-200 bg-amber-50/40 shadow-none print:hidden">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plus className="size-5" /> Criar mesas</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-4 sm:items-end">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="prefix">Nome</Label><Input id="prefix" name="prefix" defaultValue="Mesa" maxLength={40} required /></div>
            <div className="space-y-2"><Label htmlFor="quantity">Quantidade</Label><Input id="quantity" name="quantity" type="number" min={1} max={100} defaultValue={1} required /></div>
            <div className="space-y-2"><Label htmlFor="seats">Lugares</Label><Input id="seats" name="seats" type="number" min={1} max={100} defaultValue={2} required /></div>
            <Button type="submit" disabled={pending} className="h-11 bg-zinc-950 sm:col-span-4 sm:w-fit">{pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <QrCode className="mr-2 size-4" />} Gerar QR Codes</Button>
          </form>
        </CardContent>
      </Card>

      {!tables.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white text-center">
          <QrCode className="size-10 text-zinc-300" />
          <p className="mt-4 font-medium">Ainda não existem QR Codes</p>
          <p className="mt-1 max-w-md text-sm text-zinc-500">Indique quantas mesas existem. O sistema cria um código individual pronto para imprimir.</p>
        </div>
      ) : (
        <section className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3 print:grid-cols-2">
          {tables.map((table) => (
            <Card key={table.id} className={`qr-print-card overflow-hidden shadow-none ${table.is_active ? "border-zinc-200" : "border-zinc-300 bg-zinc-100 opacity-70"}`}>
              <CardContent className="p-0">
                <div className="qr-poster bg-white p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{restaurantName}</p>
                  <h2 className="mt-2 text-3xl font-semibold text-zinc-950">{table.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">Aponte a câmara e consulte o menu</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={table.qrDataUrl} alt={`QR Code ${table.name}`} className="mx-auto mt-4 aspect-square w-full max-w-72" />
                  <div className="mt-4 flex items-center justify-center gap-2 border-t border-zinc-200 pt-4 text-zinc-950">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-amber-400"><Sparkles className="size-4" /></span>
                    <div className="text-left"><p className="text-xs text-zinc-400">Menu digital por</p><p className="font-semibold">Trimos Food</p></div>
                  </div>
                </div>
                <div className="space-y-3 border-t bg-zinc-50 p-4 print:hidden">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs text-zinc-500">{table.seats} lugares</p><p className="font-mono text-xs text-zinc-400">{table.code}</p></div><Badge variant="outline" className={table.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{table.is_active ? "Ativo" : "Desativado"}</Badge></div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(table.menuUrl)}><Copy className="mr-1 size-4" /> Link</Button>
                    <Button render={<a href={table.menuUrl} target="_blank" rel="noreferrer" />} nativeButton={false} variant="outline" size="sm"><ExternalLink className="mr-1 size-4" /> Abrir</Button>
                    <Button render={<a href={table.qrDataUrl} download={`${table.name.toLowerCase().replaceAll(" ", "-")}-trimos.png`} />} nativeButton={false} variant="outline" size="sm"><Download className="mr-1 size-4" /> PNG</Button>
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => setTableActiveAction(table.id, !table.is_active))}>{table.is_active ? "Desativar" : "Ativar"}</Button>
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => regenerateTableCodeAction(table.id))}><RefreshCw className="mr-1 size-4" /> Renovar</Button>
                    <Button type="button" variant="outline" size="sm" className="text-red-600" disabled={pending} onClick={() => { if (window.confirm(`Remover ${table.name}?`)) run(() => deleteTableAction(table.id)); }}><Trash2 className="mr-1 size-4" /> Remover</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
      <style jsx global>{`@media print { body { background: white !important; } aside, header, [data-sonner-toaster] { display: none !important; } main { margin: 0 !important; } .qr-print-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #d4d4d8 !important; opacity: 1 !important; } .qr-poster { padding: 28px !important; } }`}</style>
    </div>
  );
}
