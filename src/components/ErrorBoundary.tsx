import { Component, type ReactNode } from "react";
import { usePlanStore } from "../store/usePlanStore";

type State = { error: Error | null };

/** Returns true for WebGL errors that Three.js can throw during context
 *  teardown – these are safe to swallow and recover from. */
function isWebGLCleanupError(msg: string): boolean {
  return (
    msg.includes("index is not in the allowed range") ||
    msg.includes("WebGL") ||
    msg.includes("INVALID_OPERATION") ||
    msg.includes("INVALID_VALUE")
  );
}

/**
 * Visar ett tydligt felmeddelande vid oväntade fel, istället för en
 * tom vit skärm. Loggar även till console så felet syns i DevTools.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    // Silently recover from WebGL teardown errors – don't show crash screen
    if (isWebGLCleanupError(error.message ?? "")) return { error: null };
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (isWebGLCleanupError(error.message ?? "")) {
      // Switch to 2D so the Canvas stops trying to render
      console.warn("[ErrorBoundary] WebGL teardown error, switching to 2D:", error.message);
      try { usePlanStore.getState().setViewMode("2D"); } catch { /* ignore */ }
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    // Prova även att rensa localStorage ifall korrupt data låser appen
    try {
      localStorage.removeItem("gymnastik.plans.v1");
      localStorage.removeItem("gymnastik.activePlan.v1");
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <svg
              width={28}
              height={28}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx={12} cy={12} r={10} />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              Något gick fel
            </h1>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Appen stötte på ett oväntat fel. Försök ladda om – dina sparade
              pass behålls om möjligt.
            </p>
          </div>
          <pre className="max-w-md overflow-auto rounded-md bg-slate-900 p-3 text-left text-xs text-slate-100">
            {String(this.state.error.message || this.state.error)}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md border border-surface-3 bg-white px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Försök igen
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-ink"
            >
              Ladda om & rensa data
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
