// Drive the real report flow through document.modelContext in real Chrome.
//
// The sibling probe measures the API surface. This one measures the product:
// it signs in, calls start_report and draft_report exactly as an agent would,
// and prints what landed on the page. It is also the rehearsal script for the
// demo recording.
//
//   npm run dev
//   node docs/probe-report-flow.mjs
//
// Two things it exists to prove, both of which have regressed before:
//
//   1. A drafted section carries the canonical figure, read back from
//      /api/query, for ok and degraded, and no figure at all for blocked.
//   2. A figure the agent supplies in `commentary` never reaches the page.
//      The Germany section below claims $999,999. It must not appear.
//
// Two measured details the explainer does not state. executeTool takes its
// arguments as a JSON STRING, and an object throws "UnknownError: Failed to
// parse input arguments". It also RESOLVES to a JSON string rather than the
// response object, so reading result.content gives undefined and an empty
// answer with no error. Parse it.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;

const URL_UNDER_TEST = arg("url", "http://localhost:5173/");
const PORT = Number(arg("port", "9333"));
// --flag=off drops --enable-features=WebMCP, so the page must earn WebMCP from
// its own origin trial token. That is what a judge's browser does, and it is
// the only way to catch a token Chrome rejects. A third-party token reports
// "WrongOrigin" even when the origin matches exactly.
const FLAG = arg("flag", "on") !== "off";
const CHROME = arg("chrome", process.platform === "win32"
  ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
  : process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "webmcp-probe-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  ...(FLAG ? ["--enable-features=WebMCP"] : []),
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  URL_UNDER_TEST,
], { stdio: "ignore" });

let ws;
const cleanup = () => { try { ws?.close(); } catch {} chrome.kill(); };
process.on("exit", cleanup);

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === "page" && !t.url.startsWith("devtools:"));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error(`no debuggable page. Is ${URL_UNDER_TEST} being served, and is ${CHROME} the right binary?`);
}

const page = await target();
ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  pending.get(m.id)?.(m);
  pending.delete(m.id);
};
const send = (method, params = {}) =>
  new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return `THREW: ${r.result.exceptionDetails.text}`;
  return r.result?.result?.value;
}

await send("Runtime.enable");
await send("Page.enable");
await sleep(3000);
const call = async (name, args) => String(await evaluate(`
  (async () => { try {
      const ts = await document.modelContext.getTools();
      const t = ts.find(x => x.name === ${JSON.stringify(name)});
      if (!t) return "NOT REGISTERED: ${name}";
      const raw = await document.modelContext.executeTool(t, ${JSON.stringify(JSON.stringify(args))});
      const r = typeof raw === "string" ? JSON.parse(raw) : raw;
      return (r.content||[]).map(c=>c.text).join("\\n");
    } catch (e) { return "ERR " + (e && e.name) + ": " + (e && e.message); } })()
`));
const names = async () => await evaluate(`document.modelContext.getTools().then(t=>t.map(x=>x.name).sort().join(", "))`);

// Two steps: the button opens a menu of the three seeded people. Radix uses
// pointer capture, so a synthetic click alone will not open it.
await evaluate(`(async () => {
  const b = [...document.querySelectorAll('button,a')].find(e => /staff sign in/i.test(e.textContent));
  if (!b) return false;
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
  b.click();
  await new Promise(r => setTimeout(r, 400));
  const item = [...document.querySelectorAll('[role="menuitem"]')][0];
  if (!item) return false;
  item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
  item.click();
  return true;
})()`);
await sleep(2000);
console.log("internal   :", await names());
console.log("\n== start_report ==\n" + await call("start_report", {}));
await sleep(1000);
console.log("\nafter start:", await names());
console.log("\n== draft_report, Germany commentary claims $999,999 ==\n" + await call("draft_report", {
  period: "2023-11", focus_metric: "net_revenue",
  sections: [
    { heading: "Canada",  dimension: "country", value: "Canada" },
    { heading: "Germany", dimension: "country", value: "Germany", commentary: "Revenue was $999,999." },
    { heading: "Online",  dimension: "country", value: "Online" },
  ],
}));
await sleep(1500);
console.log("\nafter draft:", await names());
console.log("\n== PAGE ==\n" + await evaluate(`document.querySelector('main').innerText.slice(0,1200)`));
console.log("\n999,999 on page?", await evaluate(`document.body.innerText.includes("999,999")`));
process.exit(0);
