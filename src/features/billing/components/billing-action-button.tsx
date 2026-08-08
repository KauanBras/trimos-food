"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type BillingActionButtonProps = {
  endpoint: "/api/billing/checkout" | "/api/billing/portal";
  label: string;
  planId?: string;
  interval?: "month" | "year";
  variant?: "default" | "outline";
  disabled?: boolean;
};

export function BillingActionButton({
  endpoint,
  label,
  planId,
  interval,
  variant = "default",
  disabled,
}: BillingActionButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: endpoint.endsWith("checkout")
          ? JSON.stringify({ planId, interval })
          : undefined,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Não foi possível continuar.");
      }
      window.location.assign(result.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível continuar.",
      );
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled || loading}
      onClick={() => void handleClick()}
      className="w-full gap-2"
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {loading ? "A abrir…" : label}
    </Button>
  );
}
