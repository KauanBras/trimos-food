"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deliverRestaurantToOwnerAction } from "@/features/platform/actions/platform-actions";

type DeliverRestaurantOwnerFormProps = {
  restaurantId: string;
  restaurantName: string;
  currentEmail?: string | null;
};

export function DeliverRestaurantOwnerForm({
  restaurantId,
  restaurantName,
  currentEmail,
}: DeliverRestaurantOwnerFormProps) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await deliverRestaurantToOwnerAction(formData);

      if (!result.ok) {
        setErrorMessage(result.message);

        toast.error("Não foi possível entregar o restaurante", {
          description: result.message,
        });

        return;
      }

      setSuccessMessage(result.message);

      toast.success("Acesso entregue", {
        description: result.message,
      });
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" />
        Entregar ao proprietário
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div>
        <p className="font-medium text-emerald-950">
          Entregar {restaurantName}
        </p>
        <p className="mt-1 text-xs text-emerald-800">
          Use esta etapa apenas quando o restaurante já estiver configurado e testado.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="restaurantId" value={restaurantId} />

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Nome do proprietário</span>
            <input
              name="ownerName"
              placeholder="Nome completo"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">E-mail do proprietário</span>
            <input
              type="email"
              name="ownerEmail"
              required
              defaultValue={currentEmail ?? ""}
              placeholder="proprietario@restaurante.pt"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-emerald-500"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={pending}
              className="min-w-40 gap-2 bg-zinc-950 text-white hover:bg-zinc-800 disabled:bg-zinc-400 disabled:text-white"
            >
              {pending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  A enviar acesso...
                </>
              ) : (
                <>
                  <Mail className="size-4" />
                  Enviar acesso
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setErrorMessage(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
