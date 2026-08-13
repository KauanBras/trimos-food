import { MonitorPlay } from "lucide-react";

export function DemoModeBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className={`mx-auto flex max-w-5xl items-start gap-3 px-4 ${compact ? "py-3" : "py-4"}`}>
        <MonitorPlay className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Demonstração Trimos Food</p>
          <p className="mt-0.5 text-sm text-amber-900">
            Pode testar à vontade. Pedidos e reservas ficam apenas no painel de demonstração e nenhum pagamento real é processado.
          </p>
        </div>
      </div>
    </div>
  );
}
