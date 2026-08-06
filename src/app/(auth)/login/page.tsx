import Link from "next/link";
import { LogIn } from "lucide-react";

import { loginAction } from "@/features/auth/actions/auth-actions";
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

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    invite?: string;
    accountType?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const isDriverInvite =
    params.accountType === "driver" && Boolean(params.invite);
  const authContext = isDriverInvite
    ? `?accountType=driver&invite=${encodeURIComponent(params.invite!)}`
    : "";

  return (
    <Card className="border-zinc-200 shadow-xl shadow-zinc-200/50">
      <CardHeader>
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
          <LogIn className="size-5" />
        </div>

        <CardTitle className="text-2xl">Iniciar sessão</CardTitle>

        <CardDescription>
          {isDriverInvite
            ? "Inicie sessão para aceitar o convite de estafeta."
            : "Entre para aceder ao seu painel."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {params.error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {params.success && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {params.success}
          </div>
        )}

        <form action={loginAction} className="space-y-5">
          {isDriverInvite && (
            <>
              <input type="hidden" name="accountType" value="driver" />
              <input type="hidden" name="invite" value={params.invite} />
            </>
          )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Palavra-passe</Label>

              <button
                type="button"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-950"
              >
                Recuperar acesso
              </button>
            </div>

            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <Button
            type="submit"
            className="h-11 w-full bg-zinc-950 hover:bg-zinc-800"
          >
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Ainda não tem conta?{" "}
          <Link
            href={`/register${authContext}`}
            className="font-semibold text-zinc-950 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
