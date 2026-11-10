// Node-only start-up work (imported from instrumentation.ts). Warm the AI-reading cache for the
// bundled sample documents in the background, so the first judge to open a demo doesn't wait.
import path from "node:path";
import { warmSampleReads } from "./lib/reader";
import { ensureCatalog } from "./lib/catalog";
import { seedActivity } from "./lib/seed-activity";
import { monitorHolds } from "./lib/workflow";

if (process.env.NODE_ENV !== "test") {
  setTimeout(() => {
    warmSampleReads(path.join(process.cwd(), "public", "samples"))
      .then(() => console.log("[warm] sample documents read"))
      .then(() => ensureCatalog())
      .then(() => console.log("[catalog] public campaigns ready"))
      .then(() => seedActivity())
      .then((r) => console.log(`[seed] shared demo activity: ${r}`))
      .catch((e) => console.warn("[warm]", (e as Error).message));
  }, 3000);
}

// Holds are only guaranteed by PayPal for three days. The daily cron (render.yaml / GitHub Actions)
// renews them; this is a second line of defence that needs no secret or outside scheduler: a few
// minutes after start-up, and then twice a day, re-check every open hold and renew the old ones.
if (process.env.NODE_ENV !== "test" && process.env.HOLD_MONITOR !== "off") {
  const run = () => monitorHolds()
    .then((r) => console.log(`[holds] checked ${r.checked}, renewed ${r.renewed}, lapsed ${r.lapsed}, failed ${r.renewFailed}`))
    .catch((e) => console.warn("[holds]", (e as Error).message));
  setTimeout(run, 4 * 60_000);
  setInterval(run, 12 * 60 * 60_000).unref?.();
}
