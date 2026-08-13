import { RestaurantSidebar } from "@/components/layout/restaurant-sidebar";
import { RestaurantTopbar } from "@/components/layout/restaurant-topbar";
import { RestaurantAudioProvider } from "@/features/notifications/components/restaurant-audio-provider";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getRestaurantOperatingStatus } from "@/lib/restaurants/operating-status";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    supabase,
    user,
    role,
    restaurantId,
    restaurant,
    membershipCount,
  } = await getCurrentRestaurant();
  const [
    { data: profile },
    { data: settings },
    { data: businessHours },
    newOrders,
    { data: onboarding },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, platform_role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("restaurant_settings")
      .select("order_sound_enabled")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "new"),
    supabase
      .from("restaurant_onboarding")
      .select("progress_percent")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
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
    restaurantSlug: restaurant.slug,
    restaurantLogoUrl: restaurant.logo_url,
    isOpen: operatingStatus.isOpen,
    operatingLabel: operatingStatus.label,
    userName,
    userAvatarUrl: profile?.avatar_url ?? null,
    role,
    newOrderCount: newOrders.count ?? 0,
    onboardingProgress: onboarding?.progress_percent ?? 0,
    isPlatformAdmin: profile?.platform_role === "super_admin",
    restaurantMembershipCount: membershipCount,
    isDemo: restaurant.is_demo,
    reservationsEnabled: restaurant.accepts_reservations,
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
      <RestaurantAudioProvider
        restaurantId={restaurantId}
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
