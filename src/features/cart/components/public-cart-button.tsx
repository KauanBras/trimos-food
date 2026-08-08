"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { readCart } from "@/features/cart/types";

export function PublicCartButton({ restaurantId, slug }: { restaurantId: string; slug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(readCart(restaurantId).reduce((total, item) => total + item.quantity, 0));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("trimos-cart-updated", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("trimos-cart-updated", refresh); };
  }, [restaurantId]);
  if (count === 0) return null;
  return <Link href={`/r/${slug}/carrinho`} className={buttonVariants({ className: "fixed bottom-5 right-5 z-40 h-12 gap-2 rounded-full bg-zinc-950 px-5 text-white shadow-xl hover:bg-zinc-800" })}><ShoppingBag className="size-5" /> Carrinho <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-950">{count}</span></Link>;
}
