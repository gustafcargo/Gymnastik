/**
 * MobileDrawer – slide-in-meny från vänster som ersätter den hoptryckta
 * toolbaren på iPhone. Grupperar alla sällan-använda kontroller (vy-
 * inställningar, verktyg, pass-åtgärder, klubb/konto) i tydliga
 * sektioner så topbaren kan andas. Endast aktiv under md-breakpointen;
 * desktop behåller full toolbar.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Building2,
  Check,
  FileText,
  FolderOpen,
  Gamepad2,
  Grid3x3,
  Image as ImageIcon,
  LogOut,
  Maximize2,
  MessageSquare,
  Plus,
  Redo2,
  RefreshCcw,
  Sliders,
  Square,
  Tag,
  Undo2,
  User,
  UserCircle2,
  X,
} from "lucide-react";
import { useStore } from "zustand";
import { usePlanStore, useTemporalStore } from "../store/usePlanStore";
import { useStudioStore } from "../store/useStudioStore";
import { useAccountStore } from "../store/useAccountStore";
import { useAuth } from "../lib/useAuth";
import { useClubs } from "../lib/useClubs";
import { useMultiplayerStore } from "../store/useMultiplayerStore";
import { HALL_TEMPLATES } from "../catalog/halls";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenPlans: () => void;
  onExportPng: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
};

function initialsFor(name?: string | null, email?: string | null): string {
  const base = (name ?? email ?? "?").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function MobileDrawer({
  open,
  onClose,
  onOpenPlans,
  onExportPng,
  onExportPdf,
}: Props) {
  const plan = usePlanStore((s) => s.plan);
  const setHall = usePlanStore((s) => s.setHall);
  const newPlan = usePlanStore((s) => s.newPlan);
  const snapToGrid = usePlanStore((s) => s.snapToGrid);
  const setSnapToGrid = usePlanStore((s) => s.setSnapToGrid);
  const viewMode = usePlanStore((s) => s.viewMode);
  const toggleViewMode = usePlanStore((s) => s.toggleViewMode);
  const gameMode = usePlanStore((s) => s.gameMode);
  const toggleGameMode = usePlanStore((s) => s.toggleGameMode);
  const showLabels = usePlanStore((s) => s.showLabels);
  const toggleLabels = usePlanStore((s) => s.toggleLabels);
  const showNotes = usePlanStore((s) => s.showNotes);
  const toggleNotes = usePlanStore((s) => s.toggleNotes);
  const toggleStudio = useStudioStore((s) => s.toggle);

  const undo = useStore(useTemporalStore, (s) => s.undo);
  const redo = useStore(useTemporalStore, (s) => s.redo);
  const pastCount = useStore(useTemporalStore, (s) => s.pastStates.length);
  const futureCount = useStore(useTemporalStore, (s) => s.futureStates.length);

  const openAccount = useAccountStore((s) => s.openPanel);
  const activeClubId = useAccountStore((s) => s.activeClubId);
  const setActiveClubId = useAccountStore((s) => s.setActiveClubId);

  const { user, signOut } = useAuth();
  const { clubs } = useClubs();
  const playerName = useMultiplayerStore((s) => s.playerName);
  const playerColor = useMultiplayerStore((s) => s.playerColor);

  const close = () => onClose();
  const act = (fn: () => void) => {
    fn();
    close();
  };

  const activeClub =
    clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="safe-top fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col bg-white shadow-2xl md:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Meny
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Stäng meny"
                className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-10">
              <Section title="Vy">
                <div className="flex gap-2 px-4 pb-1">
                  <DrawerIconButton
                    title="Ångra"
                    disabled={pastCount === 0}
                    onClick={() => undo()}
                  >
                    <Undo2 size={18} />
                  </DrawerIconButton>
                  <DrawerIconButton
                    title="Gör om"
                    disabled={futureCount === 0}
                    onClick={() => redo()}
                  >
                    <Redo2 size={18} />
                  </DrawerIconButton>
                  <DrawerIconButton
                    title="Passa vyn"
                    onClick={() =>
                      act(() =>
                        window.dispatchEvent(
                          new CustomEvent("gymnastik:fit-view"),
                        ),
                      )
                    }
                  >
                    <Maximize2 size={18} />
                  </DrawerIconButton>
                </div>
                <DrawerRow
                  icon={
                    viewMode === "3D" ? <Box size={16} /> : <Square size={16} />
                  }
                  label={viewMode === "3D" ? "3D-vy" : "2D-vy"}
                  trailing={
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-ink">
                      Växla
                    </span>
                  }
                  onClick={() => act(toggleViewMode)}
                />
                <DrawerToggle
                  icon={<Grid3x3 size={16} />}
                  label="Rutnät"
                  active={snapToGrid}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                />
                <DrawerToggle
                  icon={<Tag size={16} />}
                  label="Etiketter"
                  active={showLabels}
                  onClick={toggleLabels}
                />
                <DrawerToggle
                  icon={<MessageSquare size={16} />}
                  label="Anteckningar"
                  active={showNotes}
                  onClick={toggleNotes}
                />
              </Section>

              <Section title="Verktyg">
                <DrawerRow
                  icon={<Sliders size={16} />}
                  label="Övningsstudio"
                  onClick={() => act(toggleStudio)}
                />
                {viewMode === "3D" && (
                  <DrawerRow
                    icon={<Gamepad2 size={16} />}
                    label={gameMode ? "Avsluta spelläge" : "Starta spelläge"}
                    trailing={
                      gameMode ? (
                        <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          På
                        </span>
                      ) : null
                    }
                    onClick={() => act(toggleGameMode)}
                  />
                )}
              </Section>

              <Section title="Pass">
                <DrawerRow
                  icon={<Plus size={16} />}
                  label="Nytt pass"
                  onClick={() => act(newPlan)}
                />
                <DrawerRow
                  icon={<FolderOpen size={16} />}
                  label="Mina pass"
                  onClick={() => act(onOpenPlans)}
                />
                <DrawerRow
                  icon={<ImageIcon size={16} />}
                  label="Exportera som PNG"
                  onClick={() => {
                    void onExportPng();
                    close();
                  }}
                />
                <DrawerRow
                  icon={<FileText size={16} />}
                  label="Exportera som PDF"
                  onClick={() => {
                    void onExportPdf();
                    close();
                  }}
                />
                <div className="px-4 pt-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Hallmall
                  </label>
                  <select
                    value={plan.hall.id}
                    onChange={(e) => {
                      const h = HALL_TEMPLATES.find(
                        (h) => h.id === e.target.value,
                      );
                      if (h) setHall(h);
                    }}
                    className="mt-1 w-full rounded-md border border-surface-3 bg-surface-2 px-2 py-2 text-sm outline-none focus:border-accent"
                  >
                    {HALL_TEMPLATES.map((h) => (
                      <option key={h.id} value={h.id}>
                        {`${h.widthM} × ${h.heightM} m`}
                      </option>
                    ))}
                  </select>
                </div>
              </Section>

              <Section title="Konto">
                {!user ? (
                  <DrawerRow
                    icon={<UserCircle2 size={16} />}
                    label="Logga in"
                    onClick={() => act(() => openAccount("profile"))}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-4 pb-2 pt-1">
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full text-[11px] font-bold text-white shadow-sm"
                        style={{ background: playerColor }}
                      >
                        {initialsFor(playerName, user.email)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {playerName}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    {clubs.length > 0 && (
                      <div className="px-2 pb-1">
                        <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Aktiv förening
                        </div>
                        {clubs.map((c) => {
                          const isActive = c.id === activeClub?.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setActiveClubId(c.id)}
                              className={
                                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-2 " +
                                (isActive ? "bg-surface-2/70 font-semibold" : "")
                              }
                            >
                              <Building2
                                size={14}
                                className="text-slate-400"
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {c.name}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                {c.role === "admin"
                                  ? "Admin"
                                  : c.role === "coach"
                                    ? "Tränare"
                                    : "Medlem"}
                              </span>
                              {isActive && (
                                <Check
                                  size={14}
                                  className="text-emerald-600"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <DrawerRow
                      icon={<User size={16} />}
                      label="Profil, klubbar & hallar"
                      onClick={() => act(() => openAccount("profile"))}
                    />
                    <DrawerRow
                      icon={<RefreshCcw size={16} />}
                      label="Byt konto"
                      onClick={async () => {
                        close();
                        await signOut();
                        openAccount("profile");
                      }}
                    />
                    <DrawerRow
                      icon={<LogOut size={16} />}
                      label="Logga ut"
                      danger
                      onClick={async () => {
                        close();
                        await signOut();
                      }}
                    />
                  </>
                )}
              </Section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-1">
      <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function DrawerRow({
  icon,
  label,
  trailing,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick: () => void | Promise<void>;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2 " +
        (danger ? "text-rose-600" : "text-slate-700")
      }
    >
      <span
        className={
          "shrink-0 " + (danger ? "text-rose-500" : "text-slate-400")
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function DrawerToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-surface-2"
    >
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
          (active ? "bg-accent" : "bg-surface-3")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 rounded-full bg-white shadow transition " +
            (active ? "translate-x-[18px]" : "translate-x-0.5")
          }
        />
      </span>
    </button>
  );
}

function DrawerIconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        "grid h-11 flex-1 place-items-center rounded-md border border-surface-3 transition " +
        (disabled
          ? "cursor-not-allowed bg-surface-2 text-slate-300"
          : "bg-surface-2 text-slate-700 hover:bg-surface-3")
      }
    >
      {children}
    </button>
  );
}
