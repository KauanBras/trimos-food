"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, CheckCircle2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function DriverInviteActivation({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [existingName, setExistingName] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const inspect = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const user = data.session?.user;
      setAuthenticated(Boolean(user));
      setExistingName(String(user?.user_metadata?.full_name ?? ""));
      setRequiresPassword(!user?.user_metadata?.full_name);
      setChecking(false);
    };
    void inspect();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void inspect());
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (fullName.length < 2) {
      setSubmitting(false);
      toast.error("Indique o nome completo.");
      return;
    }
    if (requiresPassword && password.length < 8) {
      setSubmitting(false);
      toast.error("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    const attributes: { data: { full_name: string; account_type: string }; password?: string } = {
      data: { full_name: fullName, account_type: "driver" },
    };
    if (password) attributes.password = password;
    const { error: profileError } = await supabase.auth.updateUser(attributes);
    if (profileError) {
      setSubmitting(false);
      toast.error("Não foi possível preparar a conta.", { description: profileError.message });
      return;
    }

    const { error } = await supabase.rpc("accept_driver_invite", {
      requested_token: token,
    });
    if (error) {
      setSubmitting(false);
      toast.error("Não foi possível ativar o convite.", { description: error.message });
      return;
    }
    toast.success("Conta de estafeta ativada.");
    router.replace("/driver/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-5">
      <Card className="w-full max-w-lg border-zinc-200 shadow-xl">
        <CardHeader>
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-400">
            <Bike className="size-5 text-zinc-950" />
          </div>
          <CardTitle>Ativar conta de estafeta</CardTitle>
          <CardDescription>Convite individual da Rede Trimos. Depois da ativação, este link deixa de funcionar.</CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-zinc-500">
              <LoaderCircle className="size-5 animate-spin" /> A confirmar o convite…
            </div>
          ) : !authenticated ? (
            <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-semibold">Abra o link diretamente a partir do e-mail recebido.</p>
              <p className="text-sm">O acesso do e-mail expirou ou já foi utilizado. O restaurante pode reenviar um novo convite enquanto o convite principal estiver válido.</p>
            </div>
          ) : (
            <form onSubmit={activate} className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" /> E-mail confirmado</p>
                <p className="mt-1">Complete os dados para entrar na rede.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" name="fullName" defaultValue={existingName} minLength={2} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{requiresPassword ? "Criar palavra-passe" : "Nova palavra-passe (opcional)"}</Label>
                <Input id="password" name="password" type="password" minLength={8} required={requiresPassword} autoComplete="new-password" />
                <p className="text-xs text-zinc-500">Mínimo de 8 caracteres.</p>
              </div>
              <Button type="submit" disabled={submitting} className="h-11 w-full bg-zinc-950">
                {submitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
                Ativar conta de estafeta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
