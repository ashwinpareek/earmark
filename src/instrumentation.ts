// Runs once when the server starts. Warm the AI-reading cache for the bundled sample documents
// in the background, so the first judge to open a demo doesn't wait on a cold AI queue.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  const path = await import("node:path");
  const { warmSampleReads } = await import("./lib/reader");
  setTimeout(() => {
    warmSampleReads(path.join(process.cwd(), "public", "samples"))
      .then(() => console.log("[warm] sample documents read"))
      .catch((e) => console.warn("[warm]", (e as Error).message));
  }, 3000);
}
