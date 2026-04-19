import { useMemo, useState } from "react";
import { ArrowRightLeft, Building2, Plus } from "lucide-react";
import { useAccountStore } from "../../store/useAccountStore";
import { useHalls, useInventory } from "../../lib/useHalls";
import { useCapabilities } from "../../lib/useCapabilities";
import { EQUIPMENT_CATALOG } from "../../catalog/equipment";
import { useCustomEquipmentStore } from "../../store/useCustomEquipmentStore";

export function HallsTab() {
  const activeClubId = useAccountStore((s) => s.activeClubId);
  const { can } = useCapabilities(activeClubId);
  const canManageHalls = can("manage_halls");
  const canManageInventory = can("manage_inventory");
  const { halls, error, createHall } = useHalls(activeClubId);
  const [newName, setNewName] = useState("");
  const [newW, setNewW] = useState(30);
  const [newH, setNewH] = useState(24);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);

  if (!activeClubId) {
    return (
      <div className="text-sm text-slate-400">
        Välj en förening under fliken <strong>Föreningar</strong> först.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createHall(trimmed, newW, newH);
      setNewName("");
      setSelectedHallId(id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Hallar
        </div>
        {halls.length === 0 ? (
          <div className="text-sm text-slate-500">
            Inga hallar än — skapa den första nedan.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {halls.map((hall) => {
              const active = selectedHallId === hall.id;
              return (
                <li key={hall.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedHallId(active ? null : hall.id)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      active
                        ? "border-blue-400 bg-blue-500/15 text-slate-100"
                        : "border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Building2 size={14} className="text-slate-400" />
                    <span className="flex-1 font-semibold">{hall.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {hall.width_m}×{hall.height_m} m
                    </span>
                  </button>
                  {active && (
                    <InventorySection
                      hallId={hall.id}
                      allHalls={halls.map((h) => ({ id: h.id, name: h.name }))}
                      canEdit={canManageInventory}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canManageHalls && (
      <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ny hall
        </div>
        <input
          type="text"
          placeholder="Hallens namn"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Mått</span>
          <input
            type="number"
            min={5}
            max={100}
            step={0.5}
            value={newW}
            onChange={(e) => setNewW(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
          />
          <span>×</span>
          <input
            type="number"
            min={5}
            max={100}
            step={0.5}
            value={newH}
            onChange={(e) => setNewH(Number(e.target.value))}
            className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
          />
          <span>m</span>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            <Plus size={13} /> Skapa
          </button>
        </div>
        {createError && (
          <div className="text-xs text-rose-400">{createError}</div>
        )}
      </form>
      )}
    </div>
  );
}

function InventorySection({
  hallId,
  allHalls,
  canEdit,
}: {
  hallId: string;
  allHalls: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const { rows, upsertItem, moveItem } = useInventory(hallId);
  const customTypes = useCustomEquipmentStore((s) => s.customTypes);
  const [typeId, setTypeId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyError, setBusyError] = useState<string | null>(null);

  const otherHalls = allHalls.filter((h) => h.id !== hallId);

  // Slå ihop statisk katalog + användarens egna redskap. Annars hittar man
  // inte sina custom-redskap i inventarieväljaren.
  const pickableTypes = useMemo(
    () => [...EQUIPMENT_CATALOG, ...customTypes],
    [customTypes],
  );

  const typeName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of pickableTypes) m.set(t.id, t.name);
    return m;
  }, [pickableTypes]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeId || qty < 1) return;
    setBusyError(null);
    try {
      const existing = rows.find((r) => r.equipment_type_id === typeId);
      const newQty = (existing?.quantity ?? 0) + qty;
      await upsertItem(typeId, newQty);
      setTypeId("");
      setQty(1);
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  };

  const adjust = async (row: { id: string; equipment_type_id: string; quantity: number }, delta: number) => {
    setBusyId(row.id);
    setBusyError(null);
    try {
      await upsertItem(row.equipment_type_id, Math.max(0, row.quantity + delta));
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (rowId: string, targetHallId: string, quantity: number) => {
    setBusyId(rowId);
    setBusyError(null);
    try {
      await moveItem(rowId, targetHallId, quantity);
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-1.5 ml-5 border-l border-slate-700 pl-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Inventarium
      </div>
      {busyError && (
        <div className="mb-2 text-xs text-rose-400">{busyError}</div>
      )}
      {rows.length === 0 ? (
        <div className="text-xs text-slate-500">Inga redskap registrerade.</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-md bg-slate-800/40 px-2 py-1.5 text-xs"
            >
              <span className="flex-1 truncate text-slate-200">
                {typeName.get(row.equipment_type_id) ?? row.equipment_type_id}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => adjust(row, -1)}
                  disabled={busyId === row.id}
                  className="grid h-6 w-6 place-items-center rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                >
                  −
                </button>
              )}
              <span className="min-w-[1.5rem] text-center font-mono font-bold text-slate-100">
                {row.quantity}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => adjust(row, +1)}
                  disabled={busyId === row.id}
                  className="grid h-6 w-6 place-items-center rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                >
                  +
                </button>
              )}
              {canEdit && otherHalls.length > 0 && (
                <select
                  onChange={(e) => {
                    const target = e.target.value;
                    e.target.value = "";
                    if (target) void move(row.id, target, 1);
                  }}
                  defaultValue=""
                  disabled={busyId === row.id}
                  title="Flytta 1 till annan hall"
                  className="rounded-md border border-slate-600 bg-slate-800 px-1 py-0.5 text-[11px] text-slate-200"
                >
                  <option value="">
                    →
                  </option>
                  {otherHalls.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <form onSubmit={addItem} className="mt-2 flex items-center gap-1.5">
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            >
              <option value="">— Välj redskap —</option>
              {pickableTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={50}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-14 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            />
            <button
              type="submit"
              disabled={!typeId}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <Plus size={11} /> Lägg till
            </button>
          </form>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
            <ArrowRightLeft size={10} /> Flyttar 1 st åt gången; välj målhall i pilen.
          </div>
        </>
      )}
    </div>
  );
}
