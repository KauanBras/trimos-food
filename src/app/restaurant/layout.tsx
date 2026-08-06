import { redirect } from "next/navigation";

import { RestaurantSidebar } from "@/components/layout/restaurant-sidebar";
import { RestaurantTopbar } from "@/components/layout/restaurant-topbar";
import { RestaurantAudioProvider } from "@/features/notifications/components/restaurant-audio-provider";
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
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { count: initialNewOrders } = await supabase
    .from("orders")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("restaurant_id", membership.restaurant_id)
    .eq("status", "new");

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
      <RestaurantAudioProvider
        restaurantId={membership.restaurant_id}
        initialNewOrders={initialNewOrders ?? 0}
      />

      <RestaurantSidebar />

      <div className="min-w-0 flex-1">
        <RestaurantTopbar />
        <main>{children}</main>
      </div>
    </div>
  );
}
