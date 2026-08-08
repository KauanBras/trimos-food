export type CartModifier = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  quantity: number;
};

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  variant: { id: string; name: string } | null;
  modifiers: CartModifier[];
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export function getCartKey(restaurantId: string) {
  return `trimos-cart-${restaurantId}`;
}

export function readCart(restaurantId: string): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(getCartKey(restaurantId)) ?? "[]");
    return Array.isArray(parsed) ? parsed as CartItem[] : [];
  } catch {
    return [];
  }
}

export function writeCart(restaurantId: string, items: CartItem[]) {
  localStorage.setItem(getCartKey(restaurantId), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("trimos-cart-updated", { detail: { restaurantId } }));
}
