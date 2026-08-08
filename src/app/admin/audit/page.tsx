import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSuperAdmin } from "@/lib/platform/admin";
import { formatDateTime } from "@/lib/platform/format";

export default async function AdminAuditPage() {
  const { supabase } = await requireSuperAdmin();
  const { data: logs, error } = await supabase
    .from("platform_audit_logs")
    .select(
      "id, action, entity_type, entity_id, metadata, created_at, profiles(full_name), restaurants(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">Rastreabilidade</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Auditoria
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Alterações comerciais e administrativas importantes, com autor e data.
        </p>
      </header>
      <Card className="border-zinc-200 shadow-none">
        <CardHeader className="border-b border-zinc-100">
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Ação</TableHead>
                <TableHead>Restaurante</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs ?? []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="px-5 py-4">
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.restaurants?.name ?? "Plataforma"}</TableCell>
                  <TableCell>{log.profiles?.full_name ?? "Sistema"}</TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-zinc-500">
                    {log.entity_type ?? "—"}{" "}
                    {log.entity_id ? `· ${log.entity_id}` : ""}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {(logs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="p-10 text-center text-zinc-500"
                  >
                    A auditoria começará a preencher-se com as próximas
                    alterações.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
