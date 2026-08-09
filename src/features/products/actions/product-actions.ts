"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";

function getRequiredField(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo ${field} é obrigatório.`);
  }

  return value.trim();
}

export async function createProductAction(
  formData: FormData
) {
  const name = getRequiredField(formData, "name");
  const price = Number(getRequiredField(formData, "price"));

  const description =
    String(formData.get("description") ?? "").trim() || null;

  const categoryId =
    String(formData.get("categoryId") ?? "").trim() || null;

  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  if (categoryId) {
    const { data: category } = await supabase.from("categories").select("id").eq("id", categoryId).eq("restaurant_id", restaurantId).maybeSingle();
    if (!category) throw new Error("A categoria selecionada não pertence a este restaurante.");
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      restaurant_id: restaurantId,
      name,
      description,
      price,
      category_id: categoryId,
      is_active: true,
      is_available: true,
    }).select("id").single();

  if (error) {
    redirect(
      `/restaurant/products?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/restaurant/products");

  redirect(`/restaurant/products/${product.id}/edit`);
}

type ModifierGroupInput = {
  id?: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: Array<{ name: string; priceDelta: number; maxQuantity: number }>;
};

function parseModifierGroups(formData: FormData): ModifierGroupInput[] {
  const raw = String(formData.get("modifierGroups") ?? "[]");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Os complementos enviados são inválidos.");
  }

  return parsed.map((group) => {
    if (!group || typeof group !== "object") {
      throw new Error("Existe um grupo de complementos inválido.");
    }

    const value = group as Record<string, unknown>;
    const name = String(value.name ?? "").trim();
    const minSelections = Number(value.minSelections);
    const maxSelections = Number(value.maxSelections);
    const rawOptions = Array.isArray(value.options) ? value.options : [];

    if (
      !name ||
      !Number.isInteger(minSelections) ||
      !Number.isInteger(maxSelections) ||
      minSelections < 0 ||
      maxSelections < 1 ||
      minSelections > maxSelections
    ) {
      throw new Error(`Revise as regras do grupo "${name || "sem nome"}".`);
    }

    const options = rawOptions.map((option) => {
      if (!option || typeof option !== "object") {
        throw new Error(`Existe uma opção inválida em "${name}".`);
      }

      const optionValue = option as Record<string, unknown>;
      const optionName = String(optionValue.name ?? "").trim();
      const priceDelta = Number(optionValue.priceDelta);
      const maxQuantity = Number(optionValue.maxQuantity ?? 1);

      if (!optionName || !Number.isFinite(priceDelta) || priceDelta < 0 || !Number.isInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 99) {
        throw new Error(`Revise as opções do grupo "${name}".`);
      }

      return { name: optionName, priceDelta, maxQuantity };
    });

    if (options.length === 0) {
      throw new Error(`Adicione pelo menos uma opção ao grupo "${name}".`);
    }

    const id = typeof value.id === "string" && value.id ? value.id : undefined;
    return { id, name, minSelections, maxSelections, options };
  });
}

type ProductVariantInput = { name: string; price: number; isActive: boolean; isAvailable: boolean };

function parseVariants(formData: FormData): ProductVariantInput[] {
  const parsed: unknown = JSON.parse(String(formData.get("variants") ?? "[]"));
  if (!Array.isArray(parsed)) throw new Error("As variações enviadas são inválidas.");
  return parsed.map((variant) => {
    if (!variant || typeof variant !== "object") throw new Error("Existe uma variação inválida.");
    const value = variant as Record<string, unknown>;
    const name = String(value.name ?? "").trim();
    const price = Number(value.price);
    if (!name || !Number.isFinite(price) || price < 0) throw new Error("Revise o nome e o preço das variações.");
    return { name, price, isActive: value.isActive === true, isAvailable: value.isAvailable === true };
  });
}

export async function updateProductAction(productId: string, formData: FormData) {
  const name = getRequiredField(formData, "name");
  const regularPrice = Number(getRequiredField(formData, "regularPrice"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const modifierGroups = parseModifierGroups(formData);
  const variants = parseVariants(formData);
  let imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";
  const isAvailable = formData.get("isAvailable") === "on";
  const promotionEnabled = formData.get("promotionEnabled") === "on";
  const promotionPrice = Number(String(formData.get("promotionPrice") ?? ""));
  const suppliedPromotionLabel = String(formData.get("promotionLabel") ?? "").trim();

  if (!Number.isFinite(regularPrice) || regularPrice < 0) {
    throw new Error("Introduza um preço válido.");
  }

  if (promotionEnabled && variants.length > 0) {
    throw new Error("As promoções ainda não podem ser combinadas com variações. Remova as variações ou desative a promoção.");
  }

  if (
    promotionEnabled &&
    (!Number.isFinite(promotionPrice) || promotionPrice < 0 || promotionPrice >= regularPrice)
  ) {
    throw new Error("O preço promocional deve ser menor do que o preço normal.");
  }

  const price = promotionEnabled ? promotionPrice : regularPrice;
  const promotionLabel = promotionEnabled
    ? suppliedPromotionLabel || `-${Math.round((1 - promotionPrice / regularPrice) * 100)}%`
    : null;

  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  const { data: ownedProduct } = await supabase.from("products").select("id").eq("id", productId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!ownedProduct) throw new Error("Produto não encontrado.");

  if (categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (!category) {
      throw new Error("A categoria selecionada não pertence a este restaurante.");
    }
  }

  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    const allowedTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    const extension = allowedTypes[imageFile.type];
    if (!extension) throw new Error("Use uma imagem JPG, PNG, WebP ou GIF.");
    if (imageFile.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    const path = `${restaurantId}/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) throw new Error(`Não foi possível enviar a imagem: ${uploadError.message}`);
    imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  const { data: product, error: productError } = await supabase.from("products").update({
    name, description, price, category_id: categoryId, image_url: imageUrl,
    regular_price: promotionEnabled ? regularPrice : null,
    promotion_enabled: promotionEnabled,
    promotion_label: promotionLabel,
    is_active: isActive, is_available: isAvailable,
  }).eq("id", productId).eq("restaurant_id", restaurantId).select("id").single();
  if (productError || !product) throw new Error(productError?.message ?? "Produto não encontrado.");

  const groupIds: string[] = [];
  for (const [groupIndex, group] of modifierGroups.entries()) {
    if (group.id) {
      const { data: existing } = await supabase.from("modifier_groups").select("id").eq("id", group.id).eq("restaurant_id", restaurantId).maybeSingle();
      if (!existing) throw new Error("Grupo de complementos inválido.");
      groupIds.push(existing.id);
      continue;
    }
    const { data, error } = await supabase.from("modifier_groups").insert({ restaurant_id: restaurantId, name: group.name, min_selections: group.minSelections, max_selections: group.maxSelections, sort_order: groupIndex }).select("id").single();
    if (error) throw new Error(error.message);
    groupIds.push(data.id);
    const { error: optionsError } = await supabase.from("modifier_options").insert(group.options.map((option, optionIndex) => ({ modifier_group_id: data.id, name: option.name, price_delta: option.priceDelta, max_quantity: option.maxQuantity, sort_order: optionIndex })));
    if (optionsError) throw new Error(optionsError.message);
  }
  const { error: unlinkError } = await supabase.from("product_modifier_groups").delete().eq("product_id", productId);
  if (unlinkError) throw new Error(unlinkError.message);
  if (groupIds.length) {
    const { error } = await supabase.from("product_modifier_groups").insert(groupIds.map((modifierGroupId, sortOrder) => ({ product_id: productId, modifier_group_id: modifierGroupId, sort_order: sortOrder })));
    if (error) throw new Error(error.message);
  }

  const { error: deleteVariantsError } = await supabase.from("product_variants").delete().eq("product_id", productId);
  if (deleteVariantsError) throw new Error(deleteVariantsError.message);
  if (variants.length) {
    const { error } = await supabase.from("product_variants").insert(variants.map((variant, sortOrder) => ({
      product_id: productId, name: variant.name, price: variant.price,
      is_active: variant.isActive, is_available: variant.isAvailable, sort_order: sortOrder,
    })));
    if (error) throw new Error(error.message);
  }

  revalidatePath("/restaurant/products");
  revalidatePath(`/restaurant/products/${productId}/edit`);
  redirect("/restaurant/products");
}

export async function setProductAvailabilityAction(productId: string, isAvailable: boolean) {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_available: isAvailable }).eq("id", productId).eq("restaurant_id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/restaurant/products");
}

export async function updateProductOrderAction(productIds: string[]) {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_restaurant_products", {
    requested_restaurant_id: restaurantId,
    requested_product_ids: productIds,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/restaurant/products");
  revalidatePath("/r", "layout");
}

export async function duplicateProductAction(productId: string) {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data: source, error } = await supabase.from("products").select("name, description, price, regular_price, promotion_enabled, promotion_label, category_id, image_url, is_active, is_available, sort_order").eq("id", productId).eq("restaurant_id", restaurantId).single();
  if (error) throw new Error(error.message);
  const { data: copy, error: copyError } = await supabase.from("products").insert({ ...source, restaurant_id: restaurantId, name: `${source.name} (cópia)`, sort_order: source.sort_order + 1 }).select("id").single();
  if (copyError) throw new Error(copyError.message);
  const { data: links, error: linksError } = await supabase.from("product_modifier_groups").select("modifier_group_id, sort_order").eq("product_id", productId);
  if (linksError) throw new Error(linksError.message);
  if (links?.length) {
    const { error: attachError } = await supabase.from("product_modifier_groups").insert(links.map((link) => ({ ...link, product_id: copy.id })));
    if (attachError) throw new Error(attachError.message);
  }
  const { data: variants, error: variantsError } = await supabase.from("product_variants").select("name, price, is_active, is_available, sort_order").eq("product_id", productId).order("sort_order");
  if (variantsError) throw new Error(variantsError.message);
  if (variants?.length) {
    const { error: copyVariantsError } = await supabase.from("product_variants").insert(variants.map((variant) => ({ ...variant, product_id: copy.id })));
    if (copyVariantsError) throw new Error(copyVariantsError.message);
  }
  revalidatePath("/restaurant/products");
  redirect(`/restaurant/products/${copy.id}/edit`);
}

type ManagedModifierGroup = {
  id?: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isActive: boolean;
  options: Array<{ id?: string; name: string; priceDelta: number; maxQuantity: number; isActive: boolean }>;
};

export async function saveModifierGroupsAction(formData: FormData) {
  const parsed: unknown = JSON.parse(String(formData.get("groups") ?? "[]"));
  if (!Array.isArray(parsed)) throw new Error("Os grupos enviados são inválidos.");
  const groups = parsed as ManagedModifierGroup[];
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  for (const [groupOrder, rawGroup] of groups.entries()) {
    const name = String(rawGroup.name ?? "").trim();
    const minSelections = Number(rawGroup.minSelections);
    const maxSelections = Number(rawGroup.maxSelections);
    if (!name || !Number.isInteger(minSelections) || !Number.isInteger(maxSelections) || minSelections < 0 || maxSelections < 1 || minSelections > maxSelections) {
      throw new Error(`Revise as regras do grupo "${name || "sem nome"}".`);
    }
    let groupId = rawGroup.id;
    const values = { name, min_selections: minSelections, max_selections: maxSelections, is_active: rawGroup.isActive === true, sort_order: groupOrder };
    if (groupId) {
      const { data, error } = await supabase.from("modifier_groups").update(values).eq("id", groupId).eq("restaurant_id", restaurantId).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Grupo de complementos inválido.");
    } else {
      const { data, error } = await supabase.from("modifier_groups").insert({ ...values, restaurant_id: restaurantId }).select("id").single();
      if (error) throw new Error(error.message);
      groupId = data.id;
    }

    const keptOptionIds: string[] = [];
    for (const [optionOrder, rawOption] of (rawGroup.options ?? []).entries()) {
      const optionName = String(rawOption.name ?? "").trim();
      const priceDelta = Number(rawOption.priceDelta);
      const maxQuantity = Number(rawOption.maxQuantity ?? 1);
      if (!optionName || !Number.isFinite(priceDelta) || priceDelta < 0 || !Number.isInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 99) throw new Error(`Revise as opções do grupo "${name}".`);
      const optionValues = { name: optionName, price_delta: priceDelta, max_quantity: maxQuantity, is_active: rawOption.isActive === true, sort_order: optionOrder };
      if (rawOption.id) {
        const { data, error } = await supabase.from("modifier_options").update(optionValues).eq("id", rawOption.id).eq("modifier_group_id", groupId).select("id").single();
        if (error || !data) throw new Error(error?.message ?? "Opção de complemento inválida.");
        keptOptionIds.push(data.id);
      } else {
        const { data, error } = await supabase.from("modifier_options").insert({ ...optionValues, modifier_group_id: groupId }).select("id").single();
        if (error) throw new Error(error.message);
        keptOptionIds.push(data.id);
      }
    }
    if (!keptOptionIds.length) throw new Error(`Adicione pelo menos uma opção ao grupo "${name}".`);
    const { data: existingOptions, error: optionsError } = await supabase.from("modifier_options").select("id").eq("modifier_group_id", groupId);
    if (optionsError) throw new Error(optionsError.message);
    const removedIds = (existingOptions ?? []).map((option) => option.id).filter((id) => !keptOptionIds.includes(id));
    if (removedIds.length) {
      const { error } = await supabase.from("modifier_options").delete().in("id", removedIds).eq("modifier_group_id", groupId);
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/restaurant/products/modifiers");
  revalidatePath("/restaurant/products");
  redirect("/restaurant/products");
}

type ManagedCategory = {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
};

export async function saveCategoriesAction(formData: FormData) {
  const raw: unknown = JSON.parse(String(formData.get("categories") ?? "[]"));
  if (!Array.isArray(raw)) throw new Error("As categorias enviadas são inválidas.");

  const categories = raw as ManagedCategory[];
  const normalizedNames = categories.map((category) => String(category.name ?? "").trim().toLocaleLowerCase("pt-PT"));
  if (normalizedNames.some((name) => name.length < 2) || new Set(normalizedNames).size !== normalizedNames.length) {
    throw new Error("Cada categoria precisa de um nome único com pelo menos dois caracteres.");
  }

  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  for (const [sortOrder, category] of categories.entries()) {
    const values = {
      name: category.name.trim(),
      description: String(category.description ?? "").trim() || null,
      is_active: category.isActive === true,
      sort_order: sortOrder,
    };

    if (category.id) {
      const { data, error } = await supabase
        .from("categories")
        .update(values)
        .eq("id", category.id)
        .eq("restaurant_id", restaurantId)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error(error?.message ?? "Categoria inválida.");
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({ ...values, restaurant_id: restaurantId });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/restaurant/products/categories");
  revalidatePath("/restaurant/products");
  revalidatePath("/r", "layout");
  redirect("/restaurant/products");
}
