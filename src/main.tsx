// Boot order: store -> session -> fetch metric list -> UI -> register tools.
// Tools register only after the metric registry has loaded, so their schemas
// carry real metric names as enums. See docs/PLAN.md section 3, rule 4.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/context/theme-provider";
import { App } from "@/App";
import { startModelContext } from "@/mcp/register";
import "@/styles/index.css";

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
