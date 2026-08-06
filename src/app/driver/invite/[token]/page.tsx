import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type DriverInvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function DriverInvitePage({
  params,
}: DriverInvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/register?accountType=driver&invite=${encodeURIComponent(token)}`
    );
  }

  const { error } = await supabase.rpc(
    "accept_driver_invite",
    {
      requested_token: token,
    }
  );

  if (!error) {
    redirect("/driver/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-5">
      <Card className="w-full max-w-lg border-zinc-200 shadow-xl">
        <CardHeader>
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-400">
            <Bike className="size-5 text-zinc-950" />
          </div>

          <CardTitle>Convite de estafeta</CardTitle>

          <CardDescription>
            Não foi possível ativar o perfil de estafeta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>

          <Link
            href={`/login?accountType=driver&invite=${encodeURIComponent(token)}`}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Iniciar sessão
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
