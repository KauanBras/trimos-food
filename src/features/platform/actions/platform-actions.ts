"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/platform/admin";
import { getStripe } from "@/lib/stripe/server";
import type { Database, Json } from "@/types/database";

type RestaurantStatus = Database["public"]["Enums"]["restaurant_status"];
type LeadStatus = Database["public"]["Enums"]["commercial_lead_status"];

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo ${name} é obrigatório.`);
  }
  return value.trim();
}

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eurosToCents(value: string | null) {
  if (!value?.trim()) return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Indique um preço válido.");
  }
  return Math.round(amount * 100);
}

function createCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function recordAudit(
  supabase: Awaited<ReturnType<typeof requireSuperAdmin>>["supabase"],
  restaurantId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Json = {},
) {
  await supabase.rpc("record_platform_audit", {
    requested_restaurant_id: restaurantId as string,
    requested_action: action,
    requested_entity_type: entityType,
    requested_entity_id: entityId,
    requested_metadata: metadata,
  });
}

export async function updateRestaurantCommercialAction(formData: FormData) {
  const restaurantId = requiredText(formData, "restaurantId");
  const status = requiredText(formData, "status") as RestaurantStatus;
  const planId = requiredText(formData, "planId");
  const isDemo = formData.get("isDemo") === "on";
  const demoLocked = formData.get("demoLocked") === "on";
  const billingExempt = formData.get("billingExempt") === "on";
  const validStatuses: RestaurantStatus[] = [
    "draft",
    "active",
    "suspended",
    "inactive",
  ];

  if (!validStatuses.includes(status)) {
    throw new Error("Estado do restaurante inválido.");
  }

  const { supabase } = await requireSuperAdmin();
  const [{ error: restaurantError }, { error: subscriptionError }] =
    await Promise.all([
      supabase
        .from("restaurants")
        .update({ status, is_demo: isDemo, demo_locked: demoLocked })
        .eq("id", restaurantId),
      supabase
        .from("restaurant_subscriptions")
        .update({ plan_id: planId, billing_exempt: billingExempt })
        .eq("restaurant_id", restaurantId),
    ]);

  if (restaurantError || subscriptionError) {
    throw new Error(
      restaurantError?.message ||
        subscriptionError?.message ||
        "Não foi possível atualizar o restaurante.",
    );
  }

  await recordAudit(
    supabase,
    restaurantId,
    "restaurant.commercial_updated",
    "restaurant",
    restaurantId,
    { status, planId, isDemo, demoLocked, billingExempt },
  );

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
  revalidatePath("/restaurant/billing");
}

export async function resetDemoRestaurantAction(formData: FormData) {
  const restaurantId = requiredText(formData, "restaurantId");
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("reset_demo_restaurant", {
    requested_restaurant_id: restaurantId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
}

export async function updateCommercialLeadAction(formData: FormData) {
  const leadId = requiredText(formData, "leadId");
  const status = requiredText(formData, "status") as LeadStatus;
  const notes = optionalText(formData, "notes");
  const validStatuses: LeadStatus[] = [
    "new",
    "contacted",
    "qualified",
    "won",
    "lost",
  ];
  if (!validStatuses.includes(status)) throw new Error("Estado inválido.");

  const { supabase, user } = await requireSuperAdmin();
  const { error } = await supabase
    .from("commercial_leads")
    .update({
      status,
      internal_notes: notes,
      assigned_to: user.id,
      contacted_at: status === "new" ? null : new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await recordAudit(supabase, null, "lead.updated", "commercial_lead", leadId, {
    status,
  });
  revalidatePath("/admin/leads");
}

export async function saveSubscriptionPlanAction(formData: FormData) {
  const id = optionalText(formData, "id");
  const name = requiredText(formData, "name");
  const code = createCode(optionalText(formData, "code") ?? name);
  const description = optionalText(formData, "description");
  const monthlyPrice = eurosToCents(requiredText(formData, "monthlyPrice"));
  const yearlyPrice = eurosToCents(optionalText(formData, "yearlyPrice"));
  const features = (optionalText(formData, "features") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const isActive = formData.get("isActive") === "on";
  const isPublic = formData.get("isPublic") === "on";
  const sortOrder = Number(optionalText(formData, "sortOrder") ?? "0");

  if (!code || monthlyPrice === null) {
    throw new Error("Nome, código e preço mensal são obrigatórios.");
  }

  const { supabase } = await requireSuperAdmin();
  const values = {
    code,
    name,
    description,
    monthly_price_cents: monthlyPrice,
    yearly_price_cents: yearlyPrice,
    features,
    is_active: isActive,
    is_public: isPublic,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  };

  const result = id
    ? await supabase
        .from("subscription_plans")
        .update(values)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("subscription_plans")
        .insert(values)
        .select("id")
        .single();

  if (result.error) throw new Error(result.error.message);

  await recordAudit(
    supabase,
    null,
    id ? "plan.updated" : "plan.created",
    "subscription_plan",
    result.data.id,
    { code, monthlyPrice, yearlyPrice },
  );

  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

async function getOrCreatePrice({
  currentPriceId,
  productId,
  amount,
  currency,
  interval,
  planId,
}: {
  currentPriceId: string | null;
  productId: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  planId: string;
}) {
  const stripe = getStripe();

  if (currentPriceId) {
    const current = await stripe.prices.retrieve(currentPriceId);
    if (
      current.active &&
      current.unit_amount === amount &&
      current.currency === currency &&
      current.recurring?.interval === interval
    ) {
      return current.id;
    }
    await stripe.prices.update(current.id, { active: false });
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency,
    recurring: { interval },
    metadata: { trimos_plan_id: planId },
  });
  return price.id;
}

export async function syncSubscriptionPlanWithStripeAction(formData: FormData) {
  const planId = requiredText(formData, "planId");
  const { supabase } = await requireSuperAdmin();
  const { data: plan, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (error || !plan) {
    throw new Error(error?.message ?? "Plano não encontrado.");
  }

  const stripe = getStripe();
  const product = plan.stripe_product_id
    ? await stripe.products.update(plan.stripe_product_id, {
        name: `Trimos Food — ${plan.name}`,
        description: plan.description ?? undefined,
        active: plan.is_active,
        metadata: { trimos_plan_id: plan.id, trimos_plan_code: plan.code },
      })
    : await stripe.products.create({
        name: `Trimos Food — ${plan.name}`,
        description: plan.description ?? undefined,
        active: plan.is_active,
        metadata: { trimos_plan_id: plan.id, trimos_plan_code: plan.code },
      });
  const currency = plan.currency_code.toLowerCase();
  const monthlyPriceId = await getOrCreatePrice({
    currentPriceId: plan.stripe_monthly_price_id,
    productId: product.id,
    amount: plan.monthly_price_cents,
    currency,
    interval: "month",
    planId: plan.id,
  });
  const yearlyPriceId = plan.yearly_price_cents
    ? await getOrCreatePrice({
        currentPriceId: plan.stripe_yearly_price_id,
        productId: product.id,
        amount: plan.yearly_price_cents,
        currency,
        interval: "year",
        planId: plan.id,
      })
    : null;

  const { error: updateError } = await supabase
    .from("subscription_plans")
    .update({
      stripe_product_id: product.id,
      stripe_monthly_price_id: monthlyPriceId,
      stripe_yearly_price_id: yearlyPriceId,
    })
    .eq("id", plan.id);

  if (updateError) throw new Error(updateError.message);

  await recordAudit(
    supabase,
    null,
    "plan.stripe_synced",
    "subscription_plan",
    plan.id,
    { productId: product.id },
  );

  revalidatePath("/admin/plans");
  revalidatePath("/restaurant/billing");
}
