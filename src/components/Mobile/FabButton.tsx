import { Plus } from "lucide-react";

export function FabButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Lägg till redskap"
      className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-xl transition active:scale-95 lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Plus size={26} />
    </button>
  );
}
