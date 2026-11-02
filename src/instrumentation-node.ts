// Node-only start-up work (imported from instrumentation.ts). Warm the AI-reading cache for the
// bundled sample documents in the background, so the first judge to open a demo doesn't wait.
import path from "node:path";
import { warmSampleReads } from "./lib/reader";
import { ensureCatalog } from "./lib/catalog";

if (process.env.NODE_ENV !== "test") {
  setTimeout(() => {
    warmSampleReads(path.join(process.cwd(), "public", "samples"))
      .then(() => console.log("[warm] sample documents read"))
      .then(() => ensureCatalog())
      .then(() => console.log("[catalog] public campaigns ready"))
      .catch((e) => console.warn("[warm]", (e as Error).message));
  }, 3000);
}
