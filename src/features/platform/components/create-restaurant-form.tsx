"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
} from "react";
import {
  LoaderCircle,
  Plus,
  Store,
  Settings2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createInternalRestaurantAction } from "@/features/platform/actions/platform-actions";
import { selectRestaurantAction } from "@/features/restaurants/actions/restaurant-selection-actions";

type PlanOption = {
  id: string;
  name: string;
};

export function CreateRestaurantForm({
  activePlans,
}: {
  activePlans: PlanOption[];
}) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setErrorMessage(null);

    startTransition(async () => {
      const result =
        await createInternalRestaurantAction(
          formData,
        );

      if (
        !result.ok ||
        !result.restaurantId
      ) {
        const message =
          result.message ||
          "Não foi possível criar o restaurante.";

        setErrorMessage(message);

        toast.error(
          "Não foi possível criar o restaurante",
          {
            description: message,
          },
        );

        return;
      }

      toast.success(
        "Restaurante criado",
        {
          description:
            "A abrir o ambiente de configuração.",
        },
      );

      const selectionData = new FormData();

      selectionData.set(
        "restaurantId",
        result.restaurantId,
      );

      selectionData.set(
        "destination",
        "/restaurant/dashboard",
      );

      await selectRestaurantAction(
        selectionData,
      );

      router.refresh();
    });
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-none">
      <CardHeader className="border-b border-amber-100">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950">
            <Plus className="size-5" />
          </div>

          <div>
            <CardTitle className="text-lg">
              Criar restaurante para configuração
            </CardTitle>

            <p className="mt-1 text-sm text-zinc-600">
              Crie primeiro o ambiente interno.
              O proprietário só receberá acesso
              quando tudo estiver pronto.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="mb-5 grid gap-3 rounded-xl border border-amber-100 bg-white/70 p-4 text-sm text-zinc-600 md:grid-cols-3">
          <div className="flex gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-amber-600" />

            <p>
              <strong className="block text-zinc-900">
                1. Criar
              </strong>
              O restaurante nasce em modo
              rascunho.
            </p>
          </div>

          <div className="flex gap-3">
            <Settings2 className="mt-0.5 size-5 shrink-0 text-amber-600" />

            <p>
              <strong className="block text-zinc-900">
                2. Configurar
              </strong>
              Menu, horários, dados,
              reservas e operação.
            </p>
          </div>

          <div className="flex gap-3">
            <ArrowRight className="mt-0.5 size-5 shrink-0 text-amber-600" />

            <p>
              <strong className="block text-zinc-900">
                3. Entregar
              </strong>
              Só depois enviamos o acesso
              ao proprietário.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong className="block">
              Não foi possível criar o restaurante.
            </strong>

            <span className="mt-1 block">
              {errorMessage}
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <fieldset
            disabled={pending}
            className="space-y-5 disabled:opacity-70"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">
                  Nome do restaurante
                </span>

                <input
                  name="name"
                  required
                  placeholder="Ex.: Casa da Brasa"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium">
                  Link público
                </span>

                <input
                  name="slug"
                  placeholder="casa-da-brasa"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />

                <span className="block text-xs text-zinc-500">
                  Pode deixar vazio.
                </span>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium">
                  Plano inicial
                </span>

                <select
                  name="planId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
                >
                  <option
                    value=""
                    disabled
                  >
                    Selecione o plano
                  </option>

                  {activePlans.map(
                    (plan) => (
                      <option
                        key={plan.id}
                        value={plan.id}
                      >
                        {plan.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">
                Canais disponíveis
              </span>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    name="acceptsDelivery"
                    defaultChecked
                  />
                  Entrega
                </label>

                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    name="acceptsPickup"
                    defaultChecked
                  />
                  Levantamento
                </label>

                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    name="acceptsDineIn"
                  />
                  No local
                </label>

                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    name="acceptsReservations"
                  />
                  Reservas
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  pending ||
                  activePlans.length === 0
                }
                className="min-w-56 gap-2"
              >
                {pending ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Criando ambiente...
                  </>
                ) : (
                  <>
                    <Store className="size-4" />
                    Criar e configurar
                  </>
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
