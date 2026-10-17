import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { handle } from "@/lib/http";
import { HttpError } from "@/lib/store";
import { createCampaign, listCampaigns } from "@/lib/workflow";
import { ensureDemoSpace } from "@/lib/space";
import { applyLabEdits, describeEdits } from "@/lib/lab";
import { labStats, recordLabAttempt } from "@/lib/store";
import { aiProvider } from "@/lib/ai";
import { visualHash, looksAlike } from "@/lib/phash";
import { viewFor } from "@/lib/views";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Edits = z.object({
  fields: z.record(z.string(), z.string().max(80)).default({}),
  hidden: z.string().max(200).optional(),
  cropped: z.boolean().optional(),
});

const sample = async (name: string) => Buffer.from(await fs.readFile(path.join(process.cwd(), "public", "samples", name)));

export async function GET() {
  return handle(async () => {
    const s = await labStats();
    return { attempts: s.attempts, held: s.held, requested: (s.requestedCents / 100).toFixed(2), paidToForgers: "0.00", recent: s.recent.slice(0, 12) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData();
    const img = form.get("image");
    if (!(img instanceof File) || img.size === 0) throw new HttpError(400, "Attach the forged estimate");
    if (img.size > 6_000_000) throw new HttpError(400, "Image is too large");
    const edits = Edits.parse(JSON.parse(String(form.get("edits") ?? "{}")));
    const buf = Buffer.from(await img.arrayBuffer());

    // Without an AI key the server can't read pixels. It only accepts the visitor's own
    // description of the edits if the image really is (a version of) Maya's estimate.
    let fallback;
    const original = await visualHash(await sample("maya-estimate.png"), "image/png");
    if (looksAlike(await visualHash(buf, img.type || "image/png"), original)) fallback = applyLabEdits(edits);
    else if (aiProvider() === "offline") throw new HttpError(400, "Without an AI key the Lab can only read forgeries made from Maya's estimate. Add GEMINI_API_KEY to read any document.");

    const space = await ensureDemoSpace();
    // The forger is pretending to be a family; Maya's genuine campaign already exists, as in real life.
    if (!(await listCampaigns([space])).some((c) => c.docs.some((d) => d.filename === "maya-estimate.png"))) {
      await createCampaign({
        space,
        organizer: { name: "Elena Rodriguez", email: "elena.rodriguez@example.com", relationship: "Mother" },
        providerId: "prov_riverside",
        title: "Help Maya recover from emergency surgery",
        story: "Maya needed emergency surgery for appendicitis. Anything you can give goes straight to Riverside Children's Hospital.",
        files: [
          { kind: "estimate", filename: "maya-estimate.png", buf: await sample("maya-estimate.png") },
          { kind: "identity", filename: "maya-registration.png", buf: await sample("maya-registration.png") },
          { kind: "medical_note", filename: "maya-clinical-note.png", buf: await sample("maya-clinical-note.png") },
        ],
      });
    }
    const n = (await labStats()).attempts + 1;
    const c = await createCampaign({
      space,
      lab: true,
      organizer: { name: "Forgery Lab visitor", email: "forger@example.net", relationship: "Friend" },
      providerId: "prov_riverside",
      title: `Forgery Lab attempt #${n}`,
      story: "Submitted from the Forgery Lab.",
      files: [{ kind: "estimate", filename: img.type === "image/jpeg" ? "forged-estimate.jpg" : "forged-estimate.png", buf, fallback }],
    });
    const est = c.docs.find((d) => d.kind === "estimate")?.extraction;
    const requested = (est?.total ?? 0).toFixed(2);
    const fails = c.verification?.checks.filter((k) => k.status === "fail") ?? [];
    const stats = await recordLabAttempt({
      at: new Date().toISOString(),
      campaignId: c.id,
      edits: describeEdits(edits),
      requested,
      outcome: c.status === "live" ? "live" : "held",
      caughtBy: fails.map((k) => k.label),
    });
    return { campaign: viewFor(c, "reviewer"), requested, stats: { attempts: stats.attempts, held: stats.held, requested: (stats.requestedCents / 100).toFixed(2), paidToForgers: "0.00" } };
  });
}
