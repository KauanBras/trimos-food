import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCommercialLeadAction } from "@/features/platform/actions/lead-actions";

type ContactPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};
export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-zinc-50">
      <MarketingHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
        <section>
          <p className="text-sm font-medium text-amber-600">
            Demonstração acompanhada
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">
            Vamos conhecer o seu restaurante.
          </h1>
          <p className="mt-5 text-lg leading-8 text-zinc-500">
            Conte-nos como trabalha hoje. A demonstração é adaptada à sua
            operação, sem compromisso.
          </p>
          <div className="mt-10 space-y-5 text-sm text-zinc-600">
            <div className="flex gap-3">
              <MapPin className="size-5 text-amber-600" />
              Disponível para restaurantes em Portugal
            </div>
            <div className="flex gap-3">
              <Phone className="size-5 text-amber-600" />
              Contacto combinado no horário indicado
            </div>
            <div className="flex gap-3">
              <Mail className="size-5 text-amber-600" />
              Resposta ao e-mail fornecido
            </div>
          </div>
        </section>
        <Card className="border-zinc-200 bg-white shadow-xl shadow-zinc-200/40">
          <CardContent className="p-6 sm:p-8">
            {params.success ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
                <h2 className="mt-5 text-2xl font-semibold">Pedido recebido</h2>
                <p className="mt-2 text-zinc-500">
                  O contacto ficou registado com segurança. Falaremos consigo em
                  breve.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold">Pedir demonstração</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Campos assinalados são necessários.
                </p>
                {params.error ? (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {params.error}
                  </div>
                ) : null}
                <form
                  action={submitCommercialLeadAction}
                  className="mt-6 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <Label htmlFor="contactName">O seu nome *</Label>
                      <Input id="contactName" name="contactName" required />
                    </label>
                    <label className="space-y-2">
                      <Label htmlFor="restaurantName">Restaurante *</Label>
                      <Input
                        id="restaurantName"
                        name="restaurantName"
                        required
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <Label htmlFor="email">E-mail *</Label>
                      <Input id="email" name="email" type="email" required />
                    </label>
                    <label className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" name="phone" type="tel" />
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" placeholder="Ex.: Covilhã" />
                  </label>
                  <label className="block space-y-2">
                    <Label htmlFor="message">O que gostaria de melhorar?</Label>
                    <Textarea id="message" name="message" rows={5} />
                  </label>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-zinc-950"
                  >
                    Enviar pedido
                  </Button>
                  <p className="text-center text-xs text-zinc-400">
                    Ao enviar, aceita que usemos estes dados apenas para
                    responder ao seu pedido.
                  </p>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <MarketingFooter />
    </div>
  );
}
