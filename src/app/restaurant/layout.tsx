import { redirect } from "next/navigation";

import { RestaurantSidebar } from "@/components/layout/restaurant-sidebar";
import { RestaurantTopbar } from "@/components/layout/restaurant-topbar";
import { RestaurantAudioProvider } from "@/features/notifications/components/restaurant-audio-provider";
import { getRestaurantOperatingStatus } from "@/lib/restaurants/operating-status";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role, restaurants(name, logo_url, timezone)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership || !membership.restaurants) {
    redirect("/onboarding");
  }

  const restaurant = membership.restaurants;
  const [{ data: profile }, { data: settings }, { data: businessHours }, newOrders] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("restaurant_settings")
        .select("order_sound_enabled")
        .eq("restaurant_id", membership.restaurant_id)
        .maybeSingle(),
      supabase
        .from("business_hours")
        .select("day_of_week, opens_at, closes_at, is_closed")
        .eq("restaurant_id", membership.restaurant_id),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", membership.restaurant_id)
        .eq("status", "new"),
    ]);

  const operatingStatus = getRestaurantOperatingStatus(
    businessHours ?? [],
    restaurant.timezone,
  );
  const userName =
    profile?.full_name?.trim() ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Utilizador";
  const navigationProps = {
    restaurantName: restaurant.name,
    restaurantLogoUrl: restaurant.logo_url,
    isOpen: operatingStatus.isOpen,
    operatingLabel: operatingStatus.label,
    userName,
    userAvatarUrl: profile?.avatar_url ?? null,
    role: membership.role,
    newOrderCount: newOrders.count ?? 0,
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
      <RestaurantAudioProvider
        restaurantId={membership.restaurant_id}
        initialNewOrders={newOrders.count ?? 0}
        enabled={settings?.order_sound_enabled ?? true}
      />

      <RestaurantSidebar {...navigationProps} />

      <div className="min-w-0 flex-1">
        <RestaurantTopbar {...navigationProps} />
        <main>{children}</main>
      </div>
    </div>
  );
}
