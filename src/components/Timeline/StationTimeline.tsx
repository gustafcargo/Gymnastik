import { useEffect, useRef, useState } from "react";
import { Copy, MessageSquare, Plus, Trash2 } from "lucide-react";
import { usePlanStore } from "../../store/usePlanStore";

export function StationTimeline() {
  const plan = usePlanStore((s) => s.plan);
  const selectStation = usePlanStore((s) => s.selectStation);
  const addStation = usePlanStore((s) => s.addStation);
  const renameStation = usePlanStore((s) => s.renameStation);
  const setStationDuration = usePlanStore((s) => s.setStationDuration);
  const setStationNotes = usePlanStore((s) => s.setStationNotes);
  const deleteStation = usePlanStore((s) => s.deleteStation);
  const duplicateStation = usePlanStore((s) => s.duplicateStation);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const reorderStations = usePlanStore((s) => s.reorderStations);

  /** ID of the station whose notes bubble is open. */
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when bubble opens
  useEffect(() => {
    if (openNoteId) noteRef.current?.focus();
  }, [openNoteId]);

  // Close bubble on outside click
  useEffect(() => {
    if (!openNoteId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !document
          .getElementById(`note-bubble-${openNoteId}`)
          ?.contains(target) &&
        !document
          .getElementById(`note-btn-${openNoteId}`)
          ?.contains(target)
      ) {
        setOpenNoteId(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openNoteId]);

  return (
    <div className="safe-bottom flex items-stretch gap-2 overflow-x-auto border-t border-surface-3 bg-white px-3 py-2 scrollbar-thin">
      {plan.stations.map((st, idx) => {
        const active = st.id === plan.activeStationId;
        const noteOpen = openNoteId === st.id;
        const hasNotes = !!(st.notes?.trim());

        return (
          <div
            key={st.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== idx) {
                reorderStations(dragIdx, idx);
              }
              setDragIdx(null);
            }}
            onClick={() => selectStation(st.id)}
            className={
              "group relative flex w-56 shrink-0 cursor-pointer flex-col rounded-xl border px-3 py-2 shadow-xs transition " +
              (active
                ? "border-accent bg-accent-soft/60 shadow-selected"
                : "border-surface-3 bg-white hover:border-accent/40")
            }
          >
            <div className="flex items-center gap-1.5">
              <span
                className={
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold " +
                  (active
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-slate-500")
                }
              >
                {idx + 1}
              </span>
              <input
                type="text"
                value={st.name}
                onChange={(e) => renameStation(st.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-accent"
              />
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <input
                type="number"
                value={st.durationMin}
                min={1}
                onChange={(e) =>
                  setStationDuration(st.id, Number(e.target.value))
                }
                onClick={(e) => e.stopPropagation()}
                className="w-12 rounded border border-surface-3 bg-surface-2 px-1 py-0.5 text-right font-mono outline-none focus:border-accent"
                aria-label="Varaktighet i minuter"
              />
              <span>min</span>
              <span className="ml-auto">
                {st.equipment.length} redskap
              </span>
            </div>

            {/* Notes snippet – shown when notes exist and bubble is closed */}
            {hasNotes && !noteOpen && (
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                {st.notes}
              </p>
            )}

            {/* Hover actions */}
            <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
              {/* Notes / description bubble button */}
              <button
                id={`note-btn-${st.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenNoteId(noteOpen ? null : st.id);
                }}
                title={hasNotes ? "Visa/redigera förklaring" : "Lägg till förklaring"}
                className={
                  "grid h-6 w-6 place-items-center rounded transition " +
                  (noteOpen
                    ? "bg-accent text-white"
                    : hasNotes
                    ? "bg-accent-soft text-accent-ink hover:bg-accent hover:text-white"
                    : "text-slate-500 hover:bg-white")
                }
              >
                <MessageSquare size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateStation(st.id);
                }}
                title="Duplicera station"
                className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white"
              >
                <Copy size={12} />
              </button>
              {plan.stations.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Ta bort "${st.name}"?`))
                      deleteStation(st.id);
                  }}
                  title="Ta bort station"
                  className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Notes bubble / popover */}
            {noteOpen && (
              <div
                id={`note-bubble-${st.id}`}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-surface-3 bg-white shadow-lg"
              >
                {/* Triangle pointer */}
                <div className="absolute -bottom-2 left-6 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-white" />
                <div className="absolute -bottom-2.5 left-6 -z-10 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-surface-3" />

                <div className="border-b border-surface-3 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Förklaring – {st.name}
                  </p>
                </div>
                <div className="p-3">
                  <textarea
                    ref={noteRef}
                    value={st.notes ?? ""}
                    onChange={(e) => setStationNotes(st.id, e.target.value)}
                    rows={4}
                    placeholder="Beskriv stationen: övningar, mål, instruktioner för elever eller tränare…"
                    className="w-full resize-y rounded-lg border border-surface-3 bg-surface-2 p-2 text-sm outline-none focus:border-accent focus:bg-white"
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    Sparas automatiskt
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => addStation()}
        className="grid w-14 shrink-0 place-items-center rounded-xl border-2 border-dashed border-surface-3 text-slate-400 transition hover:border-accent hover:text-accent"
        title="Lägg till station"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
