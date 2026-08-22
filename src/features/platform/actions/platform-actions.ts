"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/platform/admin";
import { CURRENT_RESTAURANT_COOKIE } from "@/lib/restaurants/get-current-restaurant";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function createUniqueRestaurantSlug(
  admin: ReturnType<typeof createAdminClient>,
  requestedSlug: string,
) {
  const baseSlug = createCode(requestedSlug);
  if (!baseSlug) {
    throw new Error("Indique um nome ou endereço válido para o restaurante.");
  }

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const { data, error } = await admin
      .from("restaurants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return candidate;
  }

  throw new Error("Não foi possível gerar um endereço único.");
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const user = data.users.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (data.users.length < 200) return null;
  }

  return null;
}

export async function createRestaurantFromAdminAction(formData: FormData) {
  await requireSuperAdmin();

  const name = requiredText(formData, "name");
  const ownerEmail = requiredText(formData, "ownerEmail").toLowerCase();
  const ownerName = optionalText(formData, "ownerName");
  const requestedSlug = optionalText(formData, "slug") ?? name;
  const planId = requiredText(formData, "planId");
  const requestedStatus = requiredText(
    formData,
    "status",
  ) as RestaurantStatus;
  const isDemo = formData.get("isDemo") === "on";
  const billingExempt = isDemo || formData.get("billingExempt") === "on";
  const acceptsDelivery = formData.get("acceptsDelivery") === "on";
  const acceptsPickup = formData.get("acceptsPickup") === "on";
  const acceptsDineIn = formData.get("acceptsDineIn") === "on";
  const acceptsReservations = formData.get("acceptsReservations") === "on";
  const validStatuses: RestaurantStatus[] = [
    "draft",
    "active",
    "suspended",
    "inactive",
  ];

  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
    throw new Error("Indique um e-mail válido para o proprietário.");
  }
  if (!validStatuses.includes(requestedStatus)) {
    throw new Error("Estado inicial inválido.");
  }
  if (
    !acceptsDelivery &&
    !acceptsPickup &&
    !acceptsDineIn &&
    !acceptsReservations
  ) {
    throw new Error("Ative pelo menos um canal de atendimento.");
  }

  const admin = createAdminClient();
  const [{ data: plan, error: planError }, slug] = await Promise.all([
    admin
      .from("subscription_plans")
      .select("id")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle(),
    createUniqueRestaurantSlug(admin, requestedSlug),
  ]);

  if (planError || !plan) {
    throw new Error(planError?.message ?? "O plano selecionado não está ativo.");
  }

  let owner = await findAuthUserByEmail(admin, ownerEmail);
  let createdAuthUser = false;

  if (!owner) {
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://trimos-food.vercel.app"
    ).replace(/\/$/, "");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      ownerEmail,
      {
        data: {
          full_name: ownerName ?? name,
          account_type: "restaurant_owner",
          restaurant_name: name,
        },
        redirectTo: `${siteUrl}/auth/callback`,
      },
    );

    if (error || !data.user) {
      throw new Error(
        error?.message ?? "Não foi possível convidar o proprietário.",
      );
    }

    owner = data.user;
    createdAuthUser = true;
  }

  let restaurantId: string | null = null;

  try {
    const status: RestaurantStatus = isDemo ? "active" : requestedStatus;
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name,
        slug,
        email: ownerEmail,
        status,
        is_demo: isDemo,
        demo_locked: isDemo,
        created_by: owner.id,
        accepts_delivery: acceptsDelivery,
        accepts_pickup: acceptsPickup,
        accepts_dine_in: acceptsDineIn,
        accepts_reservations: acceptsReservations,
      })
      .select("id")
      .single();

    if (restaurantError || !restaurant) {
      throw new Error(
        restaurantError?.message ?? "Não foi possível criar o restaurante.",
      );
    }
    restaurantId = restaurant.id;

    const { error: membershipError } = await admin
      .from("restaurant_users")
      .insert({
        restaurant_id: restaurant.id,
        user_id: owner.id,
        role: "owner",
        is_active: true,
      });
    if (membershipError) throw new Error(membershipError.message);

    const { error: subscriptionError } = await admin
      .from("restaurant_subscriptions")
      .update({
        plan_id: plan.id,
        billing_exempt: billingExempt,
        status: billingExempt ? "active" : "incomplete",
      })
      .eq("restaurant_id", restaurant.id);
    if (subscriptionError) throw new Error(subscriptionError.message);

    const { supabase } = await requireSuperAdmin();
    await recordAudit(
      supabase,
      restaurant.id,
      "restaurant.created",
      "restaurant",
      restaurant.id,
      {
        name,
        slug,
        ownerEmail,
        planId,
        isDemo,
        billingExempt,
      },
    );
  } catch (error) {
    if (restaurantId) {
      await admin.from("restaurants").delete().eq("id", restaurantId);
    }
    if (createdAuthUser) {
      await admin.auth.admin.deleteUser(owner.id);
    }
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/restaurants");
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
  const setupFee = eurosToCents(requiredText(formData, "setupFee"));
  const features = (optionalText(formData, "features") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const isActive = formData.get("isActive") === "on";
  const isPublic = formData.get("isPublic") === "on";
  const sortOrder = Number(optionalText(formData, "sortOrder") ?? "0");

  if (!code || monthlyPrice === null || setupFee === null) {
    throw new Error(
      "Nome, código, preço mensal e configuração inicial são obrigatórios.",
    );
  }

  const { supabase } = await requireSuperAdmin();
  const values = {
    code,
    name,
    description,
    monthly_price_cents: monthlyPrice,
    yearly_price_cents: yearlyPrice,
    setup_fee_cents: setupFee,
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
    { code, monthlyPrice, yearlyPrice, setupFee },
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

export type CreateRestaurantAdminResult = {
  ok: boolean;
  message: string;
};

export async function createRestaurantFromAdminSafeAction(
  formData: FormData,
): Promise<CreateRestaurantAdminResult> {
  try {
    await createRestaurantFromAdminAction(formData);

    return {
      ok: true,
      message: "Restaurante criado e convite enviado com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao criar restaurante pelo administrador:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o restaurante.",
    };
  }
}

export type CreateInternalRestaurantResult = {
  ok: boolean;
  message: string;
  restaurantId?: string;
};

export async function createInternalRestaurantAction(
  formData: FormData,
): Promise<CreateInternalRestaurantResult> {
  try {
    const { user } = await requireSuperAdmin();

    const name = requiredText(formData, "name");
    const requestedSlug = optionalText(formData, "slug") ?? name;
    const planId = requiredText(formData, "planId");

    const acceptsDelivery =
      formData.get("acceptsDelivery") === "on";

    const acceptsPickup =
      formData.get("acceptsPickup") === "on";

    const acceptsDineIn =
      formData.get("acceptsDineIn") === "on";

    const acceptsReservations =
      formData.get("acceptsReservations") === "on";

    if (
      !acceptsDelivery &&
      !acceptsPickup &&
      !acceptsDineIn &&
      !acceptsReservations
    ) {
      return {
        ok: false,
        message: "Ative pelo menos um canal de atendimento.",
      };
    }

    const admin = createAdminClient();

    const [{ data: plan, error: planError }, slug] =
      await Promise.all([
        admin
          .from("subscription_plans")
          .select("id")
          .eq("id", planId)
          .eq("is_active", true)
          .maybeSingle(),

        createUniqueRestaurantSlug(
          admin,
          requestedSlug,
        ),
      ]);

    if (planError || !plan) {
      return {
        ok: false,
        message:
          planError?.message ??
          "O plano selecionado não está ativo.",
      };
    }

    let restaurantId: string | null = null;

    try {
      const {
        data: restaurant,
        error: restaurantError,
      } = await admin
        .from("restaurants")
        .insert({
          name,
          slug,
          status: "draft",
          created_by: user.id,
          accepts_delivery: acceptsDelivery,
          accepts_pickup: acceptsPickup,
          accepts_dine_in: acceptsDineIn,
          accepts_reservations: acceptsReservations,
        })
        .select("id")
        .single();

      if (restaurantError || !restaurant) {
        throw new Error(
          restaurantError?.message ??
            "Não foi possível criar o restaurante.",
        );
      }

      restaurantId = restaurant.id;

      const { error: membershipError } =
        await admin
          .from("restaurant_users")
          .upsert(
            {
              restaurant_id: restaurant.id,
              user_id: user.id,
              role: "admin",
              is_active: true,
            },
            {
              onConflict:
                "restaurant_id,user_id",
            },
          );

      if (membershipError) {
        throw new Error(
          membershipError.message,
        );
      }

      const { error: subscriptionError } =
        await admin
          .from("restaurant_subscriptions")
          .update({
            plan_id: plan.id,
            status: "incomplete",
            billing_exempt: true,
          })
          .eq(
            "restaurant_id",
            restaurant.id,
          );

      if (subscriptionError) {
        throw new Error(
          subscriptionError.message,
        );
      }

      const { supabase } =
        await requireSuperAdmin();

      await recordAudit(
        supabase,
        restaurant.id,
        "restaurant.created_internal",
        "restaurant",
        restaurant.id,
        {
          name,
          slug,
          planId,
          createdForConfiguration: true,
        },
      );

      revalidatePath("/admin");
      revalidatePath("/admin/restaurants");

      return {
        ok: true,
        message:
          "Restaurante criado. Agora pode configurar o ambiente.",
        restaurantId: restaurant.id,
      };
    } catch (error) {
      if (restaurantId) {
        await admin
          .from("restaurants")
          .delete()
          .eq("id", restaurantId);
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "Erro ao criar restaurante interno:",
      error,
    );

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar o restaurante.",
    };
  }
}


export async function configureRestaurantFromAdminAction(
  formData: FormData,
) {
  const restaurantId = requiredText(
    formData,
    "restaurantId",
  );

  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const {
    data: restaurant,
    error: restaurantError,
  } = await admin
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    throw new Error(
      restaurantError?.message ??
        "Restaurante não encontrado.",
    );
  }

  const { error: membershipError } = await admin
    .from("restaurant_users")
    .upsert(
      {
        restaurant_id: restaurantId,
        user_id: user.id,
        role: "admin",
        is_active: true,
      },
      {
        onConflict: "restaurant_id,user_id",
      },
    );

  if (membershipError) {
    throw new Error(
      `Não foi possível abrir o restaurante: ${membershipError.message}`,
    );
  }

  const cookieStore = await cookies();

  cookieStore.set(
    CURRENT_RESTAURANT_COOKIE,
    restaurantId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    },
  );

  redirect("/restaurant/dashboard");
}

export type DeliverRestaurantResult = {
  ok: boolean;
  message: string;
  invited?: boolean;
};

export async function deliverRestaurantToOwnerAction(
  formData: FormData,
): Promise<DeliverRestaurantResult> {
  try {
    const restaurantId = requiredText(formData, "restaurantId");
    const ownerEmail = requiredText(formData, "ownerEmail").toLowerCase();
    const ownerName = optionalText(formData, "ownerName");

    await requireSuperAdmin();

    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) {
      return {
        ok: false,
        message: "Indique um e-mail válido para o proprietário.",
      };
    }

    const admin = createAdminClient();

    const {
      data: restaurant,
      error: restaurantError,
    } = await admin
      .from("restaurants")
      .select("id, name, slug")
      .eq("id", restaurantId)
      .maybeSingle();

    if (restaurantError || !restaurant) {
      return {
        ok: false,
        message:
          restaurantError?.message ??
          "Restaurante não encontrado.",
      };
    }

    let owner = await findAuthUserByEmail(
      admin,
      ownerEmail,
    );

    let invited = false;

    if (!owner) {
      const siteUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ??
        "https://trimos-food.vercel.app"
      ).replace(/\/$/, "");

      const { data, error } =
        await admin.auth.admin.inviteUserByEmail(
          ownerEmail,
          {
            data: {
              full_name:
                ownerName ?? restaurant.name,
              account_type:
                "restaurant_owner",
              restaurant_name:
                restaurant.name,
            },
            redirectTo:
              `${siteUrl}/owner/activate`,
          },
        );

      if (error || !data.user) {
        return {
          ok: false,
          message:
            error?.message ??
            "Não foi possível enviar o convite.",
        };
      }

      owner = data.user;
      invited = true;
    }

    if (!owner) {
      return {
        ok: false,
        message:
          "Não foi possível identificar o proprietário.",
      };
    }

    if (ownerName) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: ownerName,
        })
        .eq("id", owner.id);

      if (profileError) {
        return {
          ok: false,
          message: profileError.message,
        };
      }
    }

    const { error: membershipError } =
      await admin
        .from("restaurant_users")
        .upsert(
          {
            restaurant_id: restaurantId,
            user_id: owner.id,
            role: "owner",
            is_active: true,
          },
          {
            onConflict:
              "restaurant_id,user_id",
          },
        );

    if (membershipError) {
      return {
        ok: false,
        message: membershipError.message,
      };
    }

    const { error: restaurantUpdateError } =
      await admin
        .from("restaurants")
        .update({
          email: ownerEmail,
          status: "active",
        })
        .eq("id", restaurantId);

    if (restaurantUpdateError) {
      return {
        ok: false,
        message:
          restaurantUpdateError.message,
      };
    }

    const { supabase } =
      await requireSuperAdmin();

    await recordAudit(
      supabase,
      restaurantId,
      "restaurant.delivered_to_owner",
      "restaurant",
      restaurantId,
      {
        ownerEmail,
        ownerName,
        invited,
      },
    );

    revalidatePath("/admin");
    revalidatePath("/admin/restaurants");

    return {
      ok: true,
      invited,
      message: invited
        ? "Restaurante entregue e convite enviado ao proprietário."
        : "Proprietário associado ao restaurante com sucesso.",
    };
  } catch (error) {
    console.error(
      "Erro ao entregar restaurante ao proprietário:",
      error,
    );

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível entregar o restaurante.",
    };
  }
}
