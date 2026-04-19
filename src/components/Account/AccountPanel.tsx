/**
 * AccountPanel – modal med flikarna Profil / Föreningar / Lag / Hallar.
 *
 * När user inte är inloggad visas magic-link-formuläret under Profil-fliken
 * och övriga flikar säger "logga in först". När user är inloggad kan
 * hen:
 *   - Redigera sitt namn/färg och öppna Gymnast-editorn.
 *   - Skapa/gå med i klubbar, välja aktiv klubb.
 *   - Skapa lag inom aktiva klubben.
 *   - Skapa hallar och hantera utrustningsinventarium per hall
 *     (inkl. flytt mellan hallar).
 */
import { X, User, Building2, Users, LayoutGrid } from "lucide-react";
import { useAccountStore, type AccountTab } from "../../store/useAccountStore";
import { useAuth } from "../../lib/useAuth";
import { ProfileTab } from "./ProfileTab";
import { ClubsTab } from "./ClubsTab";
import { TeamsTab } from "./TeamsTab";
import { HallsTab } from "./HallsTab";
import { SignInForm } from "./SignInForm";

const TABS: { id: AccountTab; label: string; Icon: typeof User }[] = [
  { id: "profile", label: "Profil",      Icon: User },
  { id: "clubs",   label: "Föreningar",  Icon: Building2 },
  { id: "teams",   label: "Lag",         Icon: Users },
  { id: "halls",   label: "Hallar",      Icon: LayoutGrid },
];

export function AccountPanel() {
  const open = useAccountStore((s) => s.open);
  const tab = useAccountStore((s) => s.tab);
  const setTab = useAccountStore((s) => s.setTab);
  const closePanel = useAccountStore((s) => s.closePanel);
  const { user, loading } = useAuth();

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "rgba(7,12,22,0.82)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={closePanel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
        style={{ maxHeight: "min(92vh, 760px)" }}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <div className="text-sm font-semibold uppercase tracking-wider">
            Mitt konto
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Stäng"
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-slate-700 bg-slate-900/80">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold uppercase tracking-wider transition ${
                  active
                    ? "border-b-2 border-blue-400 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-sm text-slate-500">Laddar…</div>
          ) : !user && tab !== "profile" ? (
            <div className="rounded-md border border-amber-400/30 bg-amber-50/5 p-4 text-sm text-amber-200">
              Logga in under fliken <strong>Profil</strong> först.
            </div>
          ) : tab === "profile" ? (
            user ? <ProfileTab /> : <SignInForm />
          ) : tab === "clubs" ? (
            <ClubsTab />
          ) : tab === "teams" ? (
            <TeamsTab />
          ) : (
            <HallsTab />
          )}
        </div>
      </div>
    </div>
  );
}
