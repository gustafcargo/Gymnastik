import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applySafariWebGLFix } from "./lib/safariWebGLFix";
import "./index.css";

// Måste köra innan någon WebGL-kontext skapas (dvs innan three.js/fiber).
applySafariWebGLFix();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
