// The document.modelContext registration rules.
//
// Registration follows session and page state. It never gates on identity.
// Nothing here refuses anyone anything; the surface changes with what is on the
// screen, which is the pattern the spec already uses for login and logout.
//
// Five groups, each with its own lifetime:
//
//   public       the catalogue and promotions tools, while the catalogue is
//                the page
//   internal     the dashboard tools, once someone has signed in
//   report       draft_report and build_deck, once the report is open
//   preview      get_preview_recipe, while a product Kestrel has written a
//                profile for is open on the catalogue
//   diagnostics  explain_data_issue and trace_lineage, once a check has failed
//
// The public set is swapped out rather than kept, because its tools drive the
// catalogue and the catalogue is not on the screen once the surface switches.
// A registered tool that cannot move the page is a tool the agent can pick by
// mistake, and Chrome's own guidance is that overlapping tools make selection
// worse. The CLAUDE.md glossary says the same in one line: signing in swaps one set
// of registered tools for the other.
//
// This is explicitly NOT a security boundary. Registration happens in the
// browser and anyone with devtools can call setSurface. The real boundary is
// server side, where the session decides the depth of an answer. See the
// CLAUDE.md glossary
// on "surface" versus "audience".
//
// Tools are registered only from the modules imported below. Nothing is ever
// built from fetched content: runtime registration has a published attack
// surface and this is the whole of our defence against it.

import { getState, subscribe } from "@/store";
import {
  ToolGroup,
  isSupported,
  noteRegistration,
  whenSupported,
} from "./adapter";
import { mountPanel } from "./panel";
import { publicTools } from "./tools/catalog";
import { customerTools } from "./tools/customer";
import { enquiryTools } from "./tools/enquiries";
import { previewTools } from "./tools/preview";
import { promotionTools } from "./tools/promotions";
import { readTools } from "./tools/read";
import { trustTools } from "./tools/trust";
import { diagnosticTools } from "./tools/trust";
import { viewTools } from "./tools/view";
import { reportEntryTools, reportTools } from "./tools/report";

const groups = {
  public: new ToolGroup("public", async () => [
    ...(await publicTools()),
    ...promotionTools(),
    ...customerTools(),
  ]),
  internal: new ToolGroup("internal", async () => [
    ...readTools(),
    ...trustTools(),
    ...(await viewTools()),
    ...reportEntryTools(),
    ...enquiryTools(),
  ]),
  // Its own group rather than part of public, because it opens and closes on
  // the open product rather than on the surface. A shopper moving from a
  // camera to a kettle should watch one tool go away.
  preview: new ToolGroup("preview", previewTools),
  report: new ToolGroup("report", reportTools),
  diagnostics: new ToolGroup("diagnostics", diagnosticTools),
};

/**
 * Serialise reconciliation. `registerTool` is async and the store can notify
 * twice for one transition, so without a queue two passes can interleave and
 * register the same group twice under two controllers.
 */
let queue: Promise<void> = Promise.resolve();

/** The product the preview group was opened for. See the note in reconcile. */
let lastPreviewKey: number | null = null;

function reconcile(): void {
  queue = queue
    .then(async () => {
      const s = getState();
      const internal = s.surface === "internal";

      await sync(groups.public, !internal);
      await sync(groups.internal, internal);
      // Keyed on the product rather than only on whether one is open. The
      // look enum is built from the open product when the group opens, so
      // moving from a camcorder to an SLR without this would leave the
      // camcorder's list of looks registered under the SLR's page.
      const previewKey = internal ? null : s.selectedProductKey;
      if (previewKey !== lastPreviewKey) {
        groups.preview.close();
        lastPreviewKey = previewKey;
      }
      await sync(groups.preview, previewKey !== null);
      await sync(groups.report, internal && s.reportOpen);
      await sync(groups.diagnostics, internal && s.hasFailedCheck);
    })
    // The queue must always settle fulfilled. A rejected queue makes every
    // later .then() skip its body and re-reject, so one bad pass would leave
    // the page permanently unable to register or unregister anything again.
    .catch((error) => {
      console.error("[superweb] reconciling the tool groups failed", error);
      noteRegistration(
        `reconcile failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
}

async function sync(group: ToolGroup, wanted: boolean): Promise<void> {
  if (wanted === group.isOpen) return;
  if (wanted) await group.open();
  else group.close();
}

let started = false;

/**
 * Boot the tool layer. Called once from src/main.tsx, outside React.
 *
 * Outside React deliberately: StrictMode double-invokes effects in development,
 * and a double-invoked registration would register every tool twice under two
 * controllers, with only one of them abortable.
 *
 * Called after the metric registry has loaded, so every schema enum below
 * carries real metric ids rather than free text an agent can typo. The registry
 * is a static import today, so it is resolved by the time this module runs;
 * when it becomes a fetch, await it before calling this.
 */
export function startModelContext(): void {
  if (started) return;
  started = true;

  // The panel mounts whether or not the API exists. A browser without WebMCP
  // gets a panel that says so, not a missing panel and a silent failure.
  mountPanel();

  noteRegistration(
    `startModelContext ran, API ${isSupported() ? "present" : "absent"} at that moment`,
  );

  if (!isSupported()) {
    // Not a refusal, a wait. Chrome has the API before we run; a host that
    // injects it later would otherwise be told, permanently and silently, that
    // this page offers nothing. Registration picks up when it lands.
    void whenSupported().then((arrived) => {
      if (!arrived) {
        noteRegistration(
          "document.modelContext never appeared within the wait, so " +
            "registration never started",
        );
        console.warn(
          "[superweb] document.modelContext never appeared, so no WebMCP " +
            "tools were registered. The dashboard works normally. Chrome 149 " +
            "or later is needed, with the origin trial or " +
            "chrome://flags/#enable-webmcp-testing.",
        );
        return;
      }
      console.info("[superweb] document.modelContext appeared late; registering now.");
      begin();
    });
    return;
  }

  begin();
}

/** Subscribe and reconcile. Split out so a late-arriving API can call it too. */
function begin(): void {
  noteRegistration("reconciler started");
  subscribe(reconcile);
  reconcile();
}
