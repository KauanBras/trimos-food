
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
	Deno.env.get("SUPABASE_URL")!,
	Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
	Deno.env.get("VAPID_SUBJECT")!,
	Deno.env.get("VAPID_PUBLIC_KEY")!,
	Deno.env.get("VAPID_PRIVATE_KEY")!,
);

serve(async (req) => {
	try {
		const {
			driver_id,
			title,
			body,
			url = "/driver/dashboard",
			tag = "delivery",
		} = await req.json();

		const { data, error } = await supabase
			.from("push_subscriptions")
			.select("endpoint,p256dh,auth_key")
			.eq("driver_id", driver_id)
			.eq("is_active", true);

		if (error) throw error;

		for (const subscription of data ?? []) {
			try {
				await webpush.sendNotification(
					{
						endpoint: subscription.endpoint,
						keys: {
							p256dh: subscription.p256dh,
							auth: subscription.auth_key,
						},
					},
					JSON.stringify({
						title,
						body,
						url,
						tag,
					}),
				);
			} catch (err) {
				console.error(err);
			}
		}

		return new Response(
			JSON.stringify({
				success: true,
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (err) {
		return new Response(
			JSON.stringify({
				success: false,
				error: String(err),
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
});
