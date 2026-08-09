import type { Json } from "@/types/database";

export type ThermalReceiptItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  variant_name: string | null;
  selected_modifiers: Json;
};

export type ThermalReceiptOrder = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  table_label: string | null;
  type: "delivery" | "pickup" | "dine_in";
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: "cash" | "terminal" | "mb_way";
  payment_status: "pending" | "paid" | "failed" | "refunded" | "awaiting_collection" | "cancelled";
  cash_tendered_amount: number | null;
  delivery_address: string | null;
  delivery_distance_km: number | null;
  notes: string | null;
  created_at: string;
  order_items: ThermalReceiptItem[];
};

export type ThermalReceiptRestaurant = {
  name: string;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
};

type PrintThermalReceiptOptions = {
  order: ThermalReceiptOrder;
  restaurant: ThermalReceiptRestaurant;
  currencyCode: string;
  paperWidth: 58 | 80;
  copies?: number;
  testMode?: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(value));
}

function formatModifiers(modifiers: Json) {
  if (!Array.isArray(modifiers)) return [];

  return modifiers.flatMap((modifier) => {
    if (!modifier || typeof modifier !== "object" || !("option" in modifier)) {
      return [];
    }

    const quantity = "quantity" in modifier ? Math.max(1, Number(modifier.quantity) || 1) : 1;
    return [`${quantity}x ${String(modifier.option)}`];
  });
}

function paymentLabel(order: ThermalReceiptOrder) {
  const method = order.payment_method === "mb_way"
    ? "MB WAY"
    : order.payment_method === "terminal"
      ? "Terminal"
      : "Dinheiro";
  const status = order.payment_status === "paid"
    ? "Pago"
    : order.payment_status === "refunded"
      ? "Reembolsado"
      : "A receber";

  return `${method} · ${status}`;
}

function orderTypeLabel(order: ThermalReceiptOrder) {
  if (order.type === "delivery") return "ENTREGA";
  if (order.type === "pickup") return "LEVANTAMENTO";
  return order.table_label ? `MESA · ${order.table_label}` : "CONSUMO NO RESTAURANTE";
}

function receiptMarkup(options: PrintThermalReceiptOptions) {
  const { order, restaurant, currencyCode, testMode } = options;
  const orderNumber = `#${order.id.slice(0, 6).toUpperCase()}`;
  const address = [restaurant.addressLine, restaurant.postalCode, restaurant.city]
    .filter(Boolean)
    .join(" · ");
  const cashChange = order.payment_method === "cash" && order.cash_tendered_amount !== null
    ? Math.max(0, order.cash_tendered_amount - order.total)
    : null;

  const items = order.order_items.map((item) => {
    const modifiers = formatModifiers(item.selected_modifiers);
    const details = [
      item.variant_name ? `<div class="detail">Variante: ${escapeHtml(item.variant_name)}</div>` : "",
      ...modifiers.map((modifier) => `<div class="detail">+ ${escapeHtml(modifier)}</div>`),
      item.notes ? `<div class="note">NOTA: ${escapeHtml(item.notes)}</div>` : "",
    ].join("");

    return `
      <div class="item">
        <div class="item-line">
          <strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong>
          <span>${escapeHtml(formatMoney(item.unit_price * item.quantity, currencyCode))}</span>
        </div>
        ${details}
      </div>`;
  }).join("");

  return `
    <section class="receipt" aria-label="Comanda ${escapeHtml(orderNumber)}">
      <header>
        <h1>${escapeHtml(restaurant.name)}</h1>
        ${address ? `<p>${escapeHtml(address)}</p>` : ""}
        ${restaurant.phone ? `<p>${escapeHtml(restaurant.phone)}</p>` : ""}
        ${testMode ? '<div class="test">TESTE DE IMPRESSÃO</div>' : ""}
      </header>

      <div class="separator"></div>
      <div class="order-number">${escapeHtml(orderNumber)}</div>
      <div class="order-type">${escapeHtml(orderTypeLabel(order))}</div>
      <p class="center">${escapeHtml(formatDate(order.created_at))}</p>

      <div class="separator"></div>
      <div class="customer">
        <strong>${escapeHtml(order.customer_name)}</strong>
        ${order.customer_phone ? `<div>${escapeHtml(order.customer_phone)}</div>` : ""}
        ${order.delivery_address ? `<div class="delivery-address">${escapeHtml(order.delivery_address)}</div>` : ""}
        ${order.delivery_distance_km !== null ? `<div>${escapeHtml(order.delivery_distance_km.toFixed(2))} km</div>` : ""}
      </div>

      <div class="separator"></div>
      <div class="items">${items}</div>
      ${order.notes ? `<div class="order-note">OBSERVAÇÕES: ${escapeHtml(order.notes)}</div>` : ""}

      <div class="separator"></div>
      <div class="total-line"><span>Subtotal</span><span>${escapeHtml(formatMoney(order.subtotal, currencyCode))}</span></div>
      ${order.delivery_fee > 0 ? `<div class="total-line"><span>Entrega</span><span>${escapeHtml(formatMoney(order.delivery_fee, currencyCode))}</span></div>` : ""}
      <div class="total-line grand-total"><span>TOTAL</span><span>${escapeHtml(formatMoney(order.total, currencyCode))}</span></div>
      <div class="payment">${escapeHtml(paymentLabel(order))}</div>
      ${cashChange !== null ? `<div class="change">Troco: ${escapeHtml(formatMoney(cashChange, currencyCode))}</div>` : ""}

      <div class="separator"></div>
      <footer>Trimos Food · Gestão do pedido</footer>
    </section>
  `;
}

export function printThermalReceipt(options: PrintThermalReceiptOptions) {
  if (typeof document === "undefined") return false;

  const copies = Math.min(3, Math.max(1, Math.round(options.copies ?? 1)));
  const contentWidth = options.paperWidth === 58 ? 52 : 72;
  const receipts = Array.from({ length: copies }, () => receiptMarkup(options)).join("");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";

  const removeFrame = () => {
    window.setTimeout(() => iframe.remove(), 1_000);
  };

  iframe.onload = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      removeFrame();
      return;
    }

    printWindow.addEventListener("afterprint", removeFrame, { once: true });
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 180);
  };

  iframe.srcdoc = `<!doctype html>
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Comanda ${escapeHtml(options.order.id.slice(0, 6).toUpperCase())}</title>
        <style>
          @page { margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; color: #000; }
          body { width: ${contentWidth}mm; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: ${options.paperWidth === 58 ? "10px" : "12px"}; line-height: 1.35; }
          .receipt { width: ${contentWidth}mm; padding: 3mm 2mm 5mm; break-after: page; page-break-after: always; }
          .receipt:last-child { break-after: auto; page-break-after: auto; }
          header, .center, footer { text-align: center; }
          h1 { margin: 0 0 1mm; font-size: 1.35em; }
          p { margin: .5mm 0; }
          .separator { margin: 2mm 0; border-top: 1px dashed #000; }
          .order-number { text-align: center; font-size: 2em; font-weight: 800; letter-spacing: .04em; }
          .order-type, .test { margin: 1mm 0; padding: 1mm; border: 1px solid #000; text-align: center; font-weight: 800; }
          .customer { line-height: 1.45; }
          .delivery-address { margin-top: 1mm; font-weight: 700; }
          .item { padding: 1.5mm 0; border-bottom: 1px dotted #777; }
          .item-line, .total-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 2mm; }
          .item-line strong { max-width: 72%; }
          .detail { padding-left: 3mm; }
          .note, .order-note { margin-top: 1mm; padding: 1mm; border: 1px solid #000; font-weight: 800; }
          .grand-total { margin-top: 1.5mm; font-size: 1.25em; font-weight: 800; }
          .payment, .change { margin-top: 1mm; text-align: right; font-weight: 700; }
          footer { font-size: .85em; }
        </style>
      </head>
      <body>${receipts}</body>
    </html>`;

  document.body.appendChild(iframe);
  window.setTimeout(removeFrame, 60_000);
  return true;
}

export function createTestThermalReceipt(restaurantName: string): ThermalReceiptOrder {
  return {
    id: "TESTE-123456",
    customer_name: "Cliente de teste",
    customer_phone: "+351 900 000 000",
    table_label: null,
    type: "pickup",
    subtotal: 12.5,
    delivery_fee: 0,
    total: 12.5,
    payment_method: "cash",
    payment_status: "awaiting_collection",
    cash_tendered_amount: 20,
    delivery_address: null,
    delivery_distance_km: null,
    notes: "Esta é uma impressão de teste.",
    created_at: new Date().toISOString(),
    order_items: [
      {
        product_name: `Pedido de teste · ${restaurantName}`,
        quantity: 1,
        unit_price: 12.5,
        notes: "Sem gengibre",
        variant_name: null,
        selected_modifiers: [{ option: "Molho de soja", quantity: 2 }],
      },
    ],
  };
}
