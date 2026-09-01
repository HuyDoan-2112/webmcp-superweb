// Boot order: render the UI, then register tools.
// The metric registry is a static import (shared/metrics.ts), resolved before
// this module runs, so tool schemas already carry real metric names as enums
// by the time registration starts.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/context/theme-provider";
import { App } from "@/App";
import { restoreSession } from "@/auth/switcher";
import { startModelContext } from "@/mcp/register";
import "@/styles/index.css";

// Before the first render, so a reload lands on the surface the cookie already
// implies rather than flashing the catalogue and jumping.
restoreSession();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root not found");

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// Tools register here, outside React, and never from a useEffect. StrictMode
// double-invokes effects in development, and a second registration pass would
// register every tool twice under two AbortControllers with only one of them
// abortable. This runs once per page load, after the metric registry is
// resolved, so every tool schema carries real metric ids as enums.
//
// It is safe to call before the first paint: registration reads the store and
// the registry, not the DOM, and the panel it mounts appends to document.body
// rather than to the React tree.
startModelContext();
