"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CircleAlert,
  CircleCheckBig,
  Clock3,
  Copy,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Palette,
  Plus,
  Save,
  Settings2,
  Store,
  Trash2,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { updateRestaurantSettingsAction } from "@/features/restaurants/actions/settings-actions";

type Restaurant = {
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  accepts_dine_in: boolean;
  accepts_reservations: boolean;
};

type Settings = {
  primary_color: string;
  secondary_color: string;
  delivery_radius_km: number;
  delivery_fee_per_km: number;
  delivery_origin_latitude: number | null;
  delivery_origin_longitude: number | null;
  minimum_order_amount: number;
  default_delivery_fee: number;
  free_delivery_from: number | null;
  default_preparation_minutes: number;
  order_sound_enabled: boolean;
  auto_accept_orders: boolean;
  reservation_slot_minutes: number;
  reservation_capacity: number;
  reservation_advance_days: number;
  reservation_duration_minutes: number;
  auto_confirm_reservations: boolean;
};

type BusinessHour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  sort_order: number;
};

type DaySchedule = {
  isOpen: boolean;
  periods: Array<{ opensAt: string; closesAt: string }>;
};

type SerializedBusinessHour = {
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  sort_order: number;
};

const dayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function timeValue(value: string | null) {
  return value?.slice(0, 5) ?? "";
}

export function RestaurantSettingsForm({
  restaurant,
  settings,
  businessHours,
}: {
  restaurant: Restaurant;
  settings: Settings;
  businessHours: BusinessHour[];
}) {
  const [pending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState(restaurant.logo_url);
  const [coverPreview, setCoverPreview] = useState(restaurant.cover_url);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [locatingRestaurant, setLocatingRestaurant] = useState(false);
  const [deliveryOrigin, setDeliveryOrigin] = useState({
    latitude: settings.delivery_origin_latitude,
    longitude: settings.delivery_origin_longitude,
  });
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(() =>
    dayNames.map((_, dayOfWeek) => {
      const dayRows = businessHours
        .filter((item) => item.day_of_week === dayOfWeek)
        .sort((a, b) => a.sort_order - b.sort_order);
      const periods = dayRows
        .filter((item) => !item.is_closed && item.opens_at && item.closes_at)
        .map((item) => ({
          opensAt: timeValue(item.opens_at),
          closesAt: timeValue(item.closes_at),
        }));

      return {
        isOpen: periods.length > 0,
        periods: periods.length
          ? periods
          : [{ opensAt: "12:00", closesAt: "15:00" }],
      };
    }),
  );
  const serializedSchedule = useMemo<SerializedBusinessHour[]>(
    () =>
      weeklySchedule.flatMap<SerializedBusinessHour>((day, dayOfWeek) =>
        day.isOpen
          ? day.periods.map((period, sortOrder) => ({
              day_of_week: dayOfWeek,
              is_closed: false,
              opens_at: period.opensAt,
              closes_at: period.closesAt,
              sort_order: sortOrder,
            }))
          : [{
              day_of_week: dayOfWeek,
              is_closed: true,
              opens_at: null,
              closes_at: null,
              sort_order: 0,
            }],
      ),
    [weeklySchedule],
  );
  const setupChecks = [
    { label: "Logótipo", complete: Boolean(restaurant.logo_url) },
    { label: "Capa", complete: Boolean(restaurant.cover_url) },
    { label: "Descrição pública", complete: Boolean(restaurant.description?.trim()) },
    { label: "E-mail", complete: Boolean(restaurant.email?.trim()) },
    { label: "NIF", complete: Boolean(restaurant.tax_number?.trim()) },
    {
      label: "Morada completa",
      complete: Boolean(
        restaurant.address_line?.trim()
        && restaurant.city?.trim()
        && restaurant.postal_code?.trim(),
      ),
    },
    {
      label: "Ponto de partida das entregas",
      complete:
        !restaurant.accepts_delivery
        || (deliveryOrigin.latitude !== null && deliveryOrigin.longitude !== null),
    },
    {
      label: "Horário semanal",
      complete: weeklySchedule.some((day) => day.isOpen),
    },
  ];
  const missingSetup = setupChecks.filter((item) => !item.complete);

  function previewFile(
    file: File | undefined,
    setter: (value: string | null) => void,
  ) {
    if (!file) return;
    setter(URL.createObjectURL(file));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateRestaurantSettingsAction(formData);
      if (result.ok) toast.success(result.message);
      else toast.error("Não foi possível guardar", { description: result.message });
    });
  }

  async function copyPublicMenuLink() {
    const publicMenuLink = `${window.location.origin}/r/${restaurant.slug}`;

    try {
      await navigator.clipboard.writeText(publicMenuLink);
      toast.success("Link do menu copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  function updateDaySchedule(dayOfWeek: number, updater: (day: DaySchedule) => DaySchedule) {
    setWeeklySchedule((current) =>
      current.map((day, index) => index === dayOfWeek ? updater(day) : day),
    );
  }

  function captureRestaurantLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Este dispositivo não suporta localização.");
      return;
    }

    setLocatingRestaurant(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryOrigin({
          latitude: Number(position.coords.latitude.toFixed(7)),
          longitude: Number(position.coords.longitude.toFixed(7)),
        });
        setLocatingRestaurant(false);
        toast.success("Localização de partida definida.");
      },
      () => {
        setLocatingRestaurant(false);
        toast.error("Não foi possível obter a localização.", {
          description: "Autorize a localização no navegador e tente novamente dentro do restaurante.",
        });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className={missingSetup.length ? "border-amber-200 bg-amber-50/60 shadow-none" : "border-emerald-200 bg-emerald-50/60 shadow-none"}>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {missingSetup.length ? (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
            ) : (
              <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            )}
            <div>
              <p className="font-semibold text-zinc-950">
                {missingSetup.length ? "Configuração comercial incompleta" : "Restaurante pronto para operar"}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {missingSetup.length
                  ? `Faltam ${missingSetup.length} dados antes da divulgação oficial.`
                  : "A identidade, a morada e a operação essencial estão configuradas."}
              </p>
              {missingSetup.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingSetup.map((item) => (
                    <span key={item.label} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800">
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-white shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-zinc-950">Link para os clientes</p>
            <p className="mt-1 truncate text-sm text-zinc-600">
              /r/{restaurant.slug}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Partilhe este endereço no Instagram, WhatsApp, Google ou num QR Code.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyPublicMenuLink()}>
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button
              type="button"
              className="gap-2 bg-zinc-950 hover:bg-zinc-800"
              render={<a href={`/r/${restaurant.slug}`} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink className="size-4" /> Abrir menu
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="identity" className="space-y-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl bg-zinc-100 p-1">
          <TabsTrigger value="identity" className="gap-2">
            <Store className="size-4" /> Identidade
          </TabsTrigger>
          <TabsTrigger value="operation" className="gap-2">
            <Settings2 className="size-4" /> Operação
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <UtensilsCrossed className="size-4" /> Reservas
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock3 className="size-4" /> Horários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity" keepMounted className="space-y-6">
          <input type="hidden" name="identitySectionPresent" value="true" />
          <Card className="overflow-hidden border-zinc-200 shadow-none">
            <div
              className="relative h-52 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 bg-cover bg-center"
              style={
                coverPreview && !removeCover
                  ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.55), transparent), url(${coverPreview})` }
                  : undefined
              }
            >
              <label className="absolute right-4 top-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/95 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">
                <Upload className="size-4" /> Alterar capa
                <input
                  type="file"
                  name="coverFile"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    previewFile(event.target.files?.[0], setCoverPreview);
                    setRemoveCover(false);
                  }}
                />
              </label>

              <div className="absolute -bottom-14 left-6 flex items-end gap-4">
                <div
                  className="flex size-28 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-zinc-950 bg-cover bg-center text-3xl font-semibold text-white shadow-xl"
                  style={
                    logoPreview && !removeLogo
                      ? { backgroundImage: `url(${logoPreview})` }
                      : undefined
                  }
                >
                  {(!logoPreview || removeLogo) && restaurant.name.slice(0, 1)}
                </div>

                <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-lg">
                  <ImageIcon className="size-4" /> Logótipo
                  <input
                    type="file"
                    name="logoFile"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      previewFile(event.target.files?.[0], setLogoPreview);
                      setRemoveLogo(false);
                    }}
                  />
                </label>
              </div>
            </div>

            <CardContent className="grid gap-6 px-6 pb-6 pt-20 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="name">Nome do restaurante</Label>
                <Input id="name" name="name" defaultValue={restaurant.name} required />
                <p className="text-xs text-zinc-500">
                  Menu público: /r/{restaurant.slug}
                </p>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="description">Descrição pública</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={restaurant.description ?? ""}
                  placeholder="Conte aos clientes o que torna o restaurante especial."
                  className="min-h-28"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={restaurant.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={restaurant.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxNumber">NIF</Label>
                <Input id="taxNumber" name="taxNumber" defaultValue={restaurant.tax_number ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Código postal</Label>
                <Input id="postalCode" name="postalCode" defaultValue={restaurant.postal_code ?? ""} />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="addressLine">Morada</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                  <Input id="addressLine" name="addressLine" defaultValue={restaurant.address_line ?? ""} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" name="city" defaultValue={restaurant.city ?? ""} />
              </div>

              <div className="flex flex-wrap gap-6 lg:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="removeLogo"
                    checked={removeLogo}
                    onCheckedChange={(checked) => setRemoveLogo(checked === true)}
                  />
                  Remover logótipo atual
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    name="removeCover"
                    checked={removeCover}
                    onCheckedChange={(checked) => setRemoveCover(checked === true)}
                  />
                  Remover capa atual
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-none">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Palette className="size-5" /> Cores da marca</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Cor principal</Label>
                <Input id="primaryColor" name="primaryColor" type="color" defaultValue={settings.primary_color} className="h-12 p-1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Cor secundária</Label>
                <Input id="secondaryColor" name="secondaryColor" type="color" defaultValue={settings.secondary_color} className="h-12 p-1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operation" keepMounted className="space-y-6">
          <input type="hidden" name="operationSectionPresent" value="true" />
          <Card className="border-zinc-200 shadow-none">
            <CardHeader><CardTitle className="text-lg">Canais de venda</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ["acceptsDelivery", "Entrega", restaurant.accepts_delivery],
                ["acceptsPickup", "Levantamento", restaurant.accepts_pickup],
                ["acceptsDineIn", "Consumo no restaurante", restaurant.accepts_dine_in],
                ["acceptsReservations", "Reservas", restaurant.accepts_reservations],
              ].map(([name, label, enabled]) => (
                <label key={String(name)} className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">
                  <span className="font-medium">{String(label)}</span>
                  <Switch name={String(name)} defaultChecked={Boolean(enabled)} />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-none">
            <CardHeader><CardTitle className="text-lg">Pedidos e entregas</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["deliveryRadiusKm", "Raio operacional (km)", settings.delivery_radius_km],
                ["minimumOrderAmount", "Pedido mínimo (€)", settings.minimum_order_amount],
                ["defaultDeliveryFee", "Taxa base de entrega (€)", settings.default_delivery_fee],
                ["deliveryFeePerKm", "Preço por quilómetro (€)", settings.delivery_fee_per_km],
                ["freeDeliveryFrom", "Entrega grátis a partir de (€)", settings.free_delivery_from ?? ""],
                ["defaultPreparationMinutes", "Preparação padrão (min)", settings.default_preparation_minutes],
              ].map(([name, label, value]) => (
                <div key={String(name)} className="space-y-2">
                  <Label htmlFor={String(name)}>{String(label)}</Label>
                  <Input id={String(name)} name={String(name)} type="number" min="0" step="0.01" defaultValue={value} />
                </div>
              ))}
              <p className="text-xs leading-5 text-zinc-500 sm:col-span-2 lg:col-span-3">
                Cálculo: taxa base + distância × preço por quilómetro. Pedidos acima do raio máximo são bloqueados automaticamente.
              </p>
              <label className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4 sm:col-span-2 lg:col-span-1">
                <span className="text-sm font-medium">Som dos pedidos</span>
                <Switch name="orderSoundEnabled" defaultChecked={settings.order_sound_enabled} />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4 sm:col-span-2 lg:col-span-1">
                <span className="text-sm font-medium">Aceitação automática</span>
                <Switch name="autoAcceptOrders" defaultChecked={settings.auto_accept_orders} />
              </label>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Ponto de partida das entregas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-zinc-500">
                Dentro do restaurante, toque no botão e autorize a localização. As coordenadas permitem calcular a distância sem enviar a morada do cliente a serviços externos.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryOriginLatitude">Latitude</Label>
                  <Input id="deliveryOriginLatitude" name="deliveryOriginLatitude" type="number" step="0.0000001" value={deliveryOrigin.latitude ?? ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryOriginLongitude">Longitude</Label>
                  <Input id="deliveryOriginLongitude" name="deliveryOriginLongitude" type="number" step="0.0000001" value={deliveryOrigin.longitude ?? ""} readOnly />
                </div>
              </div>
              <Button type="button" variant="outline" className="gap-2" disabled={locatingRestaurant} onClick={captureRestaurantLocation}>
                {locatingRestaurant ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                {locatingRestaurant ? "A obter localização..." : "Usar localização atual do restaurante"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" keepMounted>
          <input type="hidden" name="reservationsSectionPresent" value="true" />
          <Card className="border-zinc-200 shadow-none">
            <CardHeader><CardTitle className="text-lg">Regras das reservas</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {[
                ["reservationCapacity", "Capacidade por horário", settings.reservation_capacity],
                ["reservationSlotMinutes", "Intervalo dos horários (min)", settings.reservation_slot_minutes],
                ["reservationDurationMinutes", "Duração média da mesa (min)", settings.reservation_duration_minutes],
                ["reservationAdvanceDays", "Antecedência máxima (dias)", settings.reservation_advance_days],
              ].map(([name, label, value]) => (
                <div key={String(name)} className="space-y-2">
                  <Label htmlFor={String(name)}>{String(label)}</Label>
                  <Input id={String(name)} name={String(name)} type="number" min="1" defaultValue={value} />
                </div>
              ))}
              <label className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4 sm:col-span-2">
                <div>
                  <p className="font-medium">Confirmar automaticamente</p>
                  <p className="text-sm text-zinc-500">Caso contrário, as reservas chegam como pendentes.</p>
                </div>
                <Switch name="autoConfirmReservations" defaultChecked={settings.auto_confirm_reservations} />
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" keepMounted>
          <input type="hidden" name="hoursSectionPresent" value="true" />
          <input type="hidden" name="businessHoursJson" value={JSON.stringify(serializedSchedule)} />
          <Card className="border-zinc-200 shadow-none">
            <CardHeader><CardTitle className="text-lg">Horário semanal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {dayNames.map((day, dayOfWeek) => {
                const daySchedule = weeklySchedule[dayOfWeek];
                return (
                  <div key={day} className="space-y-4 rounded-2xl border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{day}</p>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={daySchedule.isOpen}
                          onCheckedChange={(checked) => updateDaySchedule(dayOfWeek, (current) => ({ ...current, isOpen: checked }))}
                        />
                        {daySchedule.isOpen ? "Aberto" : "Fechado"}
                      </label>
                    </div>

                    {daySchedule.isOpen && (
                      <div className="space-y-3">
                        {daySchedule.periods.map((period, periodIndex) => (
                          <div key={`${dayOfWeek}-${periodIndex}`} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <div className="space-y-2">
                              <Label>Abre</Label>
                              <Input
                                type="time"
                                value={period.opensAt}
                                onChange={(event) => updateDaySchedule(dayOfWeek, (current) => ({
                                  ...current,
                                  periods: current.periods.map((item, index) => index === periodIndex ? { ...item, opensAt: event.target.value } : item),
                                }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fecha</Label>
                              <Input
                                type="time"
                                value={period.closesAt}
                                onChange={(event) => updateDaySchedule(dayOfWeek, (current) => ({
                                  ...current,
                                  periods: current.periods.map((item, index) => index === periodIndex ? { ...item, closesAt: event.target.value } : item),
                                }))}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover horário ${periodIndex + 1} de ${day}`}
                              disabled={daySchedule.periods.length === 1}
                              onClick={() => updateDaySchedule(dayOfWeek, (current) => ({
                                ...current,
                                periods: current.periods.filter((_, index) => index !== periodIndex),
                              }))}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          disabled={daySchedule.periods.length >= 4}
                          onClick={() => updateDaySchedule(dayOfWeek, (current) => ({
                            ...current,
                            periods: [...current.periods, { opensAt: "18:45", closesAt: "22:30" }],
                          }))}
                        >
                          <Plus className="size-4" /> Adicionar horário
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 z-30 flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="gap-2 rounded-2xl bg-zinc-950 px-6 shadow-xl hover:bg-zinc-800">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "A guardar..." : "Guardar configurações"}
        </Button>
      </div>
    </form>
  );
}
