import Link from "next/link";
import { UserPlus } from "lucide-react";

import { registerAction } from "@/features/auth/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    invite?: string;
    accountType?: string;
  }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = await searchParams;
  const isDriverInvite =
    params.accountType === "driver" && Boolean(params.invite);
  const authContext = isDriverInvite
    ? `?accountType=driver&invite=${encodeURIComponent(params.invite!)}`
    : "";

  return (
    <Card className="border-zinc-200 shadow-xl shadow-zinc-200/50">
      <CardHeader>
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
          <UserPlus className="size-5" />
        </div>

        <CardTitle className="text-2xl">Criar conta</CardTitle>

        <CardDescription>
          {isDriverInvite
            ? "Crie a sua conta para aceitar o convite de estafeta."
            : "Crie o primeiro acesso do restaurante."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {params.error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        <form action={registerAction} className="space-y-4">
          {isDriverInvite && (
            <>
              <input type="hidden" name="accountType" value="driver" />
              <input type="hidden" name="invite" value={params.invite} />
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Nome completo"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nome@exemplo.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirmar palavra-passe
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repita a palavra-passe"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-zinc-950 hover:bg-zinc-800"
          >
            Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link
            href={`/login${authContext}`}
            className="font-semibold text-zinc-950 hover:underline"
          >
            Iniciar sessão
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
