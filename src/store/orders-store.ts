"use client";

import { create } from "zustand";

export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "delivery"
  | "completed";

export type OrderItem = {
  quantity: number;
  name: string;
  notes?: string;
};

export type Order = {
  id: string;
  customer: string;
  initials: string;
  type: "Entrega" | "Recolha";
  total: string;
  createdLabel: string;
  elapsed: number;
  estimated: number;
  status: OrderStatus;
  items: OrderItem[];
};

type OrdersState = {
  orders: Order[];
  updateStatus: (id: string, status: OrderStatus) => void;
  removeOrder: (id: string) => void;
};

const initialOrders: Order[] = [
  {
    id: "#1049",
    customer: "Ricardo Mendes",
    initials: "RM",
    type: "Entrega",
    total: "€ 41,20",
    createdLabel: "há 1 min",
    elapsed: 1,
    estimated: 30,
    status: "new",
    items: [
      { quantity: 1, name: "Combo Hiro 44 peças" },
      { quantity: 1, name: "Hot dog de salmão" },
      { quantity: 2, name: "Coca-Cola" },
    ],
  },
  {
    id: "#1048",
    customer: "João Silva",
    initials: "JS",
    type: "Entrega",
    total: "€ 34,90",
    createdLabel: "há 8 min",
    elapsed: 12,
    estimated: 25,
    status: "preparing",
    items: [
      {
        quantity: 1,
        name: "Combo Salmão 32 peças",
        notes: "Sem gengibre",
      },
      { quantity: 1, name: "Temaki salmão" },
    ],
  },
  {
    id: "#1047",
    customer: "Mariana Costa",
    initials: "MC",
    type: "Recolha",
    total: "€ 26,50",
    createdLabel: "há 19 min",
    elapsed: 19,
    estimated: 25,
    status: "ready",
    items: [
      { quantity: 1, name: "Combo 20 peças" },
      { quantity: 1, name: "Hot roll" },
    ],
  },
  {
    id: "#1046",
    customer: "Pedro Santos",
    initials: "PS",
    type: "Entrega",
    total: "€ 52,80",
    createdLabel: "há 28 min",
    elapsed: 28,
    estimated: 35,
    status: "delivery",
    items: [
      { quantity: 2, name: "Combo 20 peças" },
      { quantity: 2, name: "Temaki salmão" },
    ],
  },
];

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: initialOrders,

  updateStatus: (id, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === id ? { ...order, status } : order
      ),
    })),

  removeOrder: (id) =>
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== id),
    })),
}));
