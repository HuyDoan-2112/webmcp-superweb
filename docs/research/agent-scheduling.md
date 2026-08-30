# Agent scheduling: can a scheduled run re-invoke a page-registered WebMCP tool?

Research for issue #24, child of map #20. Investigated 2026-08-30.

There was no `docs/research/` directory before this file. Prior notes in this
repo live in `docs/adr/` (decisions) and `docs/PLAN.md` (the build plan). This
is neither a decision nor a plan, so it goes in a new `docs/research/`
directory. If that convention is wrong, move it.

## Verdict

**The assumption holds. The reason written into the map does not.**

The map's Out of scope entry reads:

> A ChatGPT schedule that calls back into the page and re-invokes a tool.
> Scheduled tasks run without a browser tab; the tool hands over a window instead.

The conclusion is correct on every documented ChatGPT path as of 2026-08-30: no
scheduled ChatGPT task can call a tool registered with `document.modelContext`.
So the line stays in Out of scope and nothing needs to move back onto the route.

The stated reason is wrong, though. Scheduled ChatGPT runs *can* drive a
browser. OpenAI runs a server-side Chromium ("cloud browser") that keeps working
in the background after the user closes their laptop, and OpenAI's own help
centre says agent invocations that are part of scheduled tasks count against the
agent message limit. The barrier is not the absence of a browser. The barrier is
that the one ChatGPT surface which speaks WebMCP is the desktop app's built-in
browser, and site tools there exist only while a human has the page open.

That distinction matters because it changes what would falsify the design. "No
browser exists" is an architectural fact that will not change. "The scheduler's
browser does not happen to be the WebMCP browser" is a product-surface fact that
could change in a release note. The reminder tool should be designed so that it
degrades gracefully rather than breaks if that day comes.

Recommended edit to the map's Out of scope line, replacing the second sentence:

> No ChatGPT scheduling surface can reach a page-registered tool: site tools
> live only in the desktop app's built-in browser and only while the page is
> open. The tool hands over a window instead.

## How ChatGPT scheduled tasks actually execute

Verified from OpenAI primary sources.

**Web and mobile tasks run server-side, unattended, with the user offline.**
Tasks "run one-time or recurring tasks, monitor for changes, and respond to
supported events". Web tasks "can use uploaded context and connected tools, but
they can't work directly in a folder on your computer"
([Scheduled tasks doc](https://learn.chatgpt.com/docs/automations)).

**Desktop app tasks run locally, in a project directory or a git worktree, with
the machine on and the app running.** They run under a sandbox mode
(read-only / workspace-write / full access) and use `approval_policy = "never"`
where org policy allows it (same doc). These are Codex-shaped tasks about files,
not pages.

**Both are background execution.** The article is explicit that tasks run
whether or not the user is present, and that results arrive by push notification
or email
([Scheduled tasks in ChatGPT](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)).

**There is a browsing context available to background ChatGPT work, but it is
not the tab.** Cloud browser "gives ChatGPT Work its own browser on a separate
computer in the cloud", can "read web pages, click buttons, enter information
into forms", and its FAQ answers "Can a task keep running after I leave?" with
"Yes. Cloud browser runs remotely in ChatGPT's own computer and can continue in
the background, including after you close your computer or turn off your phone."
It "does not use your personal browser's open tabs, browsing history, saved
passwords, cookies, extensions, or existing sign-ins"
([Using cloud browser in ChatGPT](https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt)).
Separately, the agent help article states that "each unique agent invocation
will count against the monthly message limit. This includes agent requests that
are part of scheduled tasks"
([ChatGPT agent](https://help.openai.com/en/articles/11752874-chatgpt-agent)),
which is the closest thing to a first-party statement that a scheduled run can
put an agent in front of a browser.

So the honest one-line answer to "server-side or in a browsing context" is:
**server-side, and the server has a browser.**

## Can a scheduled run interact with page-registered WebMCP tools?

No, on every documented path.

**Site tools are ChatGPT's WebMCP implementation and they are desktop-built-in-browser only.**
"In the built-in browser in the ChatGPT desktop app, ChatGPT Work and Codex can
discover and use these tools when they are available"
([Site tools](https://learn.chatgpt.com/docs/webmcp)). The help centre version is
blunter: "Site tools are currently available only in the ChatGPT desktop app's
built-in browser, not in Chrome"
([Using site tools in the ChatGPT desktop app](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app)).

**Tools die with the page.** "What happens when I close the webpage? Site tools
are available only while the relevant webpage is open. Reopen the page if you
want ChatGPT to use its tools." And: "Tools belong to the page that provides
them. Closing or navigating away from a page can make its tools unavailable."
(same two sources).

**The cloud browser is not a site-tools surface.** No OpenAI document lists the
cloud browser as a place site tools work; the site tools docs name only the
desktop built-in browser, and additionally exclude Enterprise and Edu
workspaces, and GPT-5.6 Luna.

**The scheduling documentation never mentions a browser at all.** The full
markdown of `learn.chatgpt.com/docs/automations` contains zero occurrences of
the string "browser" and zero of "WebMCP" or "site tool". The built-in browser
doc at `learn.chatgpt.com/docs/browser` contains zero occurrences of "schedul",
"background", "unattended" or "headless". Two docs that would have to reference
each other for a scheduled run to reach a page tool do not reference each other.
This is documented silence, not a documented denial. Treat it as strong but not
conclusive.

**Is there any documented path from a schedule back into a site's tool surface?**
None that exists today. There is one that is proposed and not shipped: the
supplemental
[WebMCP for Service Workers explainer](https://github.com/webmachinelearning/webmcp/blob/main/docs/service-workers.md)
(Brandon Walderman, Microsoft, first published 2025-08-28) describes registering
a service worker as a WebMCP provider so that "tool calls are handled in the
service worker script ... without needing to open any browser windows". Its
opening problem statement is exactly this ticket's question: "Sometimes, an agent
may require context and tools from a site that the user doesn't currently have
open." It is an explainer with TBD discovery mechanics, listed in the main
explainer under "Future work". Nothing ships it, and it uses `self.agent.provideContext`
rather than `document.modelContext`, so it is not even API-aligned with what we
register today.

The main WebMCP explainer also lists as an explicit **non-goal**: "Headless
browsing scenarios: While it may be possible to run these tools in headless
environments, this API is primarily designed for local browser workflows with a
human in the loop", and "Fully autonomous workflows: The API is not intended for
fully autonomous agents operating without human oversight or where a browser UI
is not present"
([WebMCP explainer](https://github.com/webmachinelearning/webmcp)). Chrome's
developer guide repeats the first of these
([Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp)). The standard
itself is on our side of this argument.

## What it takes to create a scheduled task from inside a conversation

**It is user-initiated in the normal case, and it is a plain conversational ask.**
"To create a task, ask ChatGPT to complete an action, such as 'Let me know when
my package is delivered.'" (help centre). The docs have a section headed "Ask
ChatGPT to create or update scheduled tasks": "You can create and update
scheduled tasks from a ChatGPT or Codex chat. Describe the work, when it should
run, and whether each run should return to the current chat or start a new chat.
ChatGPT can draft the prompt, choose the right destination, and update the task"
(automations doc).

**Skills can create tasks; websites cannot.** "Skills can also create or update
scheduled tasks. For example, a skill for babysitting a pull request could set up
a scheduled task that checks the PR status with the GitHub plugin" (automations
doc). A skill is an OpenAI-side artifact the user installs. There is no
documented API, tool, or return-value convention by which a page-registered
WebMCP tool creates or requests a schedule.

**So a tool response cannot reliably steer the model into offering one.** It can
only do what any context does: make the offer likely. That is exactly the
sequencing-through-return-values pattern `CLAUDE.md` already commits to, and it is
the honest framing of the map's "demonstrated, not afforded" decision. Nothing
found contradicts that decision. What is worth knowing is that the steer competes
with hard limits the user may already be against:

- Active task caps: 3 Free and Go, 5 Plus, 10 Business and Edu, 15 Pro and
  Enterprise. At the cap, creation fails until something is paused or deleted.
- Minimum interval: once per hour on eligible paid plans; Free is one-time or at
  most once per day.
- Scheduled tasks do not support voice chats or GPTs.
- A task pauses if it is inactive, needs action, or its chat is deleted.

(All from the help centre article.)

## What a scheduler needs handed to it

Three formats are documented, in increasing precision. A tool that returns a
validity window should probably supply all three, because we do not control which
host reads it.

1. **Natural-language cadence.** The primary creation path. "Every weekday at
   8:00 AM", "daily", "weekly". Free-plan tasks are coarser still: they "use
   flexible scheduling windows, such as morning, afternoon, or night. Hourly
   schedules and exact delivery times require an eligible paid plan" (help
   centre).
2. **RFC 5545 recurrence rule.** The documented advanced format, exposed in the
   desktop UI: "For an advanced schedule, edit its RFC 5545 recurrence rule
   (RRULE), such as `RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0`"
   (automations doc).
3. **Absolute instants plus a time zone.** Time zone is first-class: a shared
   task snapshot "includes a snapshot of the task title, instructions, schedule,
   and original time zone", and the recipient is prompted to "adjust the schedule
   for your time zone if needed" (help centre). Any window we return without an
   explicit zone is ambiguous by the host's own model.

Practical shape for a promotions validity window: ISO-8601 `starts_at` and
`ends_at` with offset, an IANA zone name, a one-line human phrase for the
reminder moment ("the morning the promotion expires"), and an RRULE only if the
window genuinely recurs. Anything finer than hourly is unusable, so do not return
a moment the scheduler cannot hit.

## Do other hosts differ enough that ChatGPT-only design is a mistake?

Yes, they differ. No, it is probably not a mistake for this submission.

**Claude for Chrome already schedules work into a real browser tab.** The
extension declares the `alarms` permission for exactly this: "This lets Claude run
scheduled tasks at specific times you choose, like checking something on a website
at a set time every day", alongside `tabs` ("open, close, and switch between
browser tabs") and `debugger`. The feature is described directly: "Scheduled
tasks: Set recurring browser tasks to run automatically on your schedule ...
daily, weekly, monthly, or annually. You can schedule your Claude in Chrome
shortcuts to run automatically by clicking the clock icon"
([Get started with Claude in Chrome](https://support.anthropic.com/en/articles/12012173-getting-started-with-claude-for-chrome)).
This is a schedule that lands in the user's own Chrome, in a real tab, on a real
page. Claude Cowork also has server-side scheduled tasks that "run on their own
even when your computer is off"
([Schedule recurring tasks in Claude Cowork](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork)).

The gap in the Claude story is the other half: I found **no** Anthropic
documentation stating that Claude for Chrome consumes `document.modelContext` /
WebMCP tools. Its documented mechanism is DOM control through the `debugger`
permission. So Claude has the scheduling half but not the demonstrated WebMCP
half; ChatGPT has the WebMCP half but not the scheduling half. Neither host
currently closes the loop.

**Microsoft Copilot schedules server-side prompts, not browser sessions.**
Scheduled prompts run in Copilot Chat across Teams, Outlook and Office.com, are
capped at 10 scheduled prompts and 15 runs before reactivation, and deliver
results by email
([Schedule your most used Copilot prompts](https://support.microsoft.com/en-us/microsoft-365-copilot/schedule-your-most-used-copilot-prompts),
[Manage Scheduled Prompts for Microsoft Copilot](https://learn.microsoft.com/en-us/microsoft-365/copilot/scheduled-prompts)).
Nothing found connects those to a page's tool surface.

Conclusion for the submission: the tool should hand over a **window**, described
in host-neutral terms (absolute instants, a zone, a plain phrase, optionally an
RRULE), and let whichever host is driving decide how to schedule it. That design
is correct for ChatGPT today, correct for Copilot, and forward-compatible with a
Claude-in-Chrome future where the callback becomes possible. Designing a
ChatGPT-specific callback would have been the mistake; designing a host-neutral
window is not.

## Verified versus inferred

**Verified from primary sources** (all quoted above, all OpenAI, Anthropic,
Microsoft or W3C Web Machine Learning CG documents):

- Web scheduled tasks run server-side and unattended; desktop ones run locally
  with the app running.
- Cloud browser is a real server-side browser that continues in the background.
- Agent invocations inside scheduled tasks are a documented thing.
- Site tools (WebMCP) exist only in the desktop app's built-in browser, only
  while the page is open, and not in Enterprise or Edu.
- Tasks are created by asking in conversation; skills can create them; caps,
  minimum intervals and pause behaviour are as listed.
- RRULE, natural language and time zone are all documented schedule inputs.
- Headless and fully autonomous use are explicit non-goals of the WebMCP
  explainer.
- Claude for Chrome runs scheduled tasks in the user's own Chrome tabs.
- Service-worker WebMCP is a published explainer, not a shipped feature.

**Inferred, and flagged as such:**

- That a *desktop* scheduled task cannot open the built-in browser and use site
  tools. No document says it can and no document says it cannot. The inference
  rests on the two docs never referencing each other, on desktop scheduled tasks
  being described entirely in filesystem and worktree terms, and on site tools
  being framed throughout as a you-and-the-agent-look-at-the-same-page feature.
  This is the weakest link in the verdict. If someone has a paid desktop app and
  ten minutes, the falsifying experiment is: open our page in the built-in
  browser, confirm the site tools arrow appears, then schedule a task in that
  chat and see whether the run touches a tool. That would settle it empirically.
- That Claude for Chrome does not consume WebMCP tools. Absence of documentation,
  not a denial.
- That no host will ship a schedule-to-page-tool path before Sep 3. Judgement,
  though a safe one.

## Sources

- https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- https://learn.chatgpt.com/docs/automations (markdown at `.md`)
- https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app
- https://learn.chatgpt.com/docs/webmcp (markdown at `.md`)
- https://learn.chatgpt.com/docs/browser (markdown at `.md`)
- https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt
- https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app
- https://help.openai.com/en/articles/11752874-chatgpt-agent
- https://github.com/webmachinelearning/webmcp (main explainer)
- https://github.com/webmachinelearning/webmcp/blob/main/docs/service-workers.md
- https://developer.chrome.com/docs/ai/webmcp
- https://support.anthropic.com/en/articles/12012173-getting-started-with-claude-for-chrome
- https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- https://support.microsoft.com/en-us/microsoft-365-copilot/schedule-your-most-used-copilot-prompts
- https://learn.microsoft.com/en-us/microsoft-365/copilot/scheduled-prompts
