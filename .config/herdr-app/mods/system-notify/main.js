// macOS notifications for agents while Herdr isn't the active app. Herdr's own
// toast is drawn inside its window, so it goes unseen while another app is in
// front. When an agent needs you or finishes and the window isn't active, this
// posts a system notification through terminal-notifier. Clicking it brings
// Herdr forward on that agent. The notification goes away once the agent is
// seen or working again. Herdr already plays its sound, so this one is silent.
//
// It draws nothing. layouts/my-main.json gives it a 0 px block, because a mod
// only runs while its block is in the shown layout. It checks on a timer, not
// in render: Herdr may skip drawing while its window is hidden or covered.

import { View, div } from "gpui-kit";
import { agents, terminals, window, exec, home, notify } from "herdr";

const NOTIFIER = "terminal-notifier";
const BUNDLE_ID = "dev.herdr.app";
const CHECK_MS = 1000;

const group = (address) => `herdr:${address}`;
// terminal-notifier parses each value as a property list, so a leading bracket
// or quote must be escaped or the notification is dropped.
const plain = (text) => (/^[[({<"']/.test(text) ? `\\${text}` : text);
// Addresses go into a shell command for the click; anything unexpected gets no click action.
const safeAddress = (address) => /^[\w./-]+$/.test(address);

export default class SystemNotify extends View {
  init(_props, cx) {
    /** Each agent's status at the last check, by address. */
    this.last = new Map();
    /** Agents with a notification on screen. */
    this.posted = new Set();
    this.warned = false;
    if (window()?.platform !== "macos") return;
    cx.timer.every(CHECK_MS, (cx) => this.check(cx));
  }

  check(cx) {
    const away = !window()?.active;
    const now = new Map();
    for (const agent of agents()) {
      now.set(agent.address, agent.status);
      const before = this.last.get(agent.address);
      // A new agent or a reload: remember its status without announcing it.
      if (before === undefined || before === agent.status) continue;
      // Herdr says "done" when nobody was looking; a focused pane may go straight to "idle".
      const finished = before === "working" && (agent.status === "done" || agent.status === "idle");
      if (away && (agent.status === "blocked" || finished)) this.post(cx, agent);
      else if (this.posted.has(agent.address) && (agent.status === "working" || agent.status === "idle")) this.clear(cx, agent.address);
    }
    for (const address of this.posted) if (!now.has(address)) this.clear(cx, address);
    this.last = now;
  }

  post(cx, agent) {
    const who = agent.program?.name || agent.app || "Agent";
    const where = [agent.space_name, agent.tab_name].filter(Boolean).join(" › ");
    // The agent's own words (Pi: the session name, or what a dialog asks) beat the terminal title.
    const said = terminals().find((t) => t.address === agent.address)?.report?.msg;
    const what = said || agent.title;
    const args = [
      "-title", plain(agent.status === "blocked" ? `${who} needs you` : `${who} has finished`),
      "-message", plain(what || where || agent.address),
      "-group", group(agent.address),
      "-activate", BUNDLE_ID,
    ];
    if (what && where) args.push("-subtitle", plain(where));
    if (safeAddress(agent.address)) {
      args.push("-execute", `'${home()}/.local/bin/herdr-app' do agent.focus --terminal '${agent.address}'`);
    }
    this.posted.add(agent.address);
    this.send(cx, args);
  }

  clear(cx, address) {
    this.posted.delete(address);
    this.send(cx, ["-remove", group(address)]);
  }

  send(cx, args) {
    cx.spawn(async () => {
      try {
        const result = await exec(NOTIFIER, args);
        if (result.code !== 0) throw new Error(result.stderr.trim() || `exit ${result.code}`);
      } catch (error) {
        console.log(`system-notify: ${NOTIFIER} ${args[0]} failed: ${error}`);
        // Say so once inside Herdr, since the system notification never came.
        if (this.warned) return;
        this.warned = true;
        notify({
          title: "System notifications failed",
          body: `${NOTIFIER}: ${error}. Install it with: brew install terminal-notifier`,
          level: "warning",
        });
      }
    });
  }

  render() {
    return div();
  }
}
