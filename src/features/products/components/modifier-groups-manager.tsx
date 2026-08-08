"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveModifierGroupsAction } from "@/features/products/actions/product-actions";

type Option = { id?: string; name: string; priceDelta: number; maxQuantity: number; isActive: boolean };
type Group = { id?: string; name: string; minSelections: number; maxSelections: number; isActive: boolean; options: Option[] };

const fieldClassName = "mt-2 w-full rounded-xl border px-4 py-3";

export function ModifierGroupsManager({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState(initialGroups);
  const router = useRouter();
  function updateGroup(index: number, next: Partial<Group>) { setGroups((current) => current.map((group, currentIndex) => currentIndex === index ? { ...group, ...next } : group)); }
  function updateOption(groupIndex: number, optionIndex: number, next: Partial<Option>) { updateGroup(groupIndex, { options: groups[groupIndex].options.map((option, currentIndex) => currentIndex === optionIndex ? { ...option, ...next } : option) }); }
  function moveGroup(index: number, direction: -1 | 1) { const destination = index + direction; if (destination < 0 || destination >= groups.length) return; const next = [...groups]; [next[index], next[destination]] = [next[destination], next[index]]; setGroups(next); }

  return <form action={saveModifierGroupsAction} className="space-y-5">
    <input type="hidden" name="groups" value={JSON.stringify(groups)} />
    <div className="flex justify-end"><Button type="button" variant="outline" className="gap-2" onClick={() => setGroups([...groups, { name: "", minSelections: 0, maxSelections: 1, isActive: true, options: [{ name: "", priceDelta: 0, maxQuantity: 1, isActive: true }] }])}><Plus className="size-4" /> Novo grupo</Button></div>
    {groups.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-zinc-500">Ainda não existem grupos reutilizáveis.</div>}
    {groups.map((group, groupIndex) => <section key={group.id ?? `new-${groupIndex}`} className="space-y-4 rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><div className="flex-1"><label className="text-sm font-medium">Nome do grupo</label><input required value={group.name} onChange={(event) => updateGroup(groupIndex, { name: event.target.value })} className={fieldClassName} placeholder="Ex: Extras" /></div><div className="mt-7 flex"><Button type="button" variant="ghost" size="icon" disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)} aria-label="Mover grupo para cima"><ArrowUp className="size-4" /></Button><Button type="button" variant="ghost" size="icon" disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, 1)} aria-label="Mover grupo para baixo"><ArrowDown className="size-4" /></Button></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><div><label className="text-sm font-medium">Mínimo</label><input type="number" min="0" max={group.maxSelections} value={group.minSelections} onChange={(event) => updateGroup(groupIndex, { minSelections: Number(event.target.value) })} className={fieldClassName} /></div><div><label className="text-sm font-medium">Máximo</label><input type="number" min="1" value={group.maxSelections} onChange={(event) => updateGroup(groupIndex, { maxSelections: Number(event.target.value) })} className={fieldClassName} /></div><label className="mt-7 flex items-center gap-2 rounded-xl border px-4"><input type="checkbox" checked={group.isActive} onChange={(event) => updateGroup(groupIndex, { isActive: event.target.checked })} /> Grupo ativo</label></div>
      <div className="space-y-3">{group.options.map((option, optionIndex) => <div key={option.id ?? `new-${optionIndex}`} className="grid gap-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-[1fr_9rem_9rem_auto_auto] sm:items-end"><div><label className="text-sm font-medium">Opção</label><input required value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })} className={fieldClassName} /></div><div><label className="text-sm font-medium">Preço extra (€)</label><input type="number" min="0" step="0.01" value={option.priceDelta} onChange={(event) => updateOption(groupIndex, optionIndex, { priceDelta: Number(event.target.value) })} className={fieldClassName} /></div><div><label className="text-sm font-medium">Máx. quantidade</label><input type="number" min="1" max="99" value={option.maxQuantity} onChange={(event) => updateOption(groupIndex, optionIndex, { maxQuantity: Number(event.target.value) })} className={fieldClassName} /></div><label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={option.isActive} onChange={(event) => updateOption(groupIndex, optionIndex, { isActive: event.target.checked })} /> Ativa</label><Button type="button" variant="ghost" size="icon" disabled={group.options.length === 1} onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, index) => index !== optionIndex) })} aria-label="Remover opção"><Trash2 className="size-4" /></Button></div>)}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => updateGroup(groupIndex, { options: [...group.options, { name: "", priceDelta: 0, maxQuantity: 1, isActive: true }] })}><Plus className="size-4" /> Adicionar opção</Button>
      </div>
    </section>)}
    <div className="flex gap-3"><Button type="submit" className="bg-zinc-950">Guardar grupos</Button><Button type="button" variant="outline" onClick={() => router.push("/restaurant/products")}>Cancelar</Button></div>
  </form>;
}
