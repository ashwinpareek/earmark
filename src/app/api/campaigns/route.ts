import { handle } from "@/lib/http";
import { createCampaign, listCampaigns } from "@/lib/workflow";
import { HttpError } from "@/lib/store";
import { provider } from "@/lib/providers";
import type { DocKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return handle(async () =>
    (await listCampaigns()).map((c) => ({
      id: c.id, title: c.title, status: c.status, patient: c.patient, goal: c.goal, currency: c.currency, createdAt: c.createdAt,
      provider: provider(c.providerId)?.name ?? "",
      held: c.donations.filter((d) => d.status === "held").reduce((s, d) => s + Number(d.pledged), 0).toFixed(2),
      donors: c.donations.filter((d) => ["held", "captured", "voided"].includes(d.status)).length,
      decision: c.verification?.decision ?? null,
    })),
  );
}

const KINDS: DocKind[] = ["estimate", "identity", "medical_note"];

export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData();
    const s = (k: string) => String(form.get(k) ?? "").trim();
    const name = s("organizerName"), email = s("organizerEmail");
    if (!name) throw new HttpError(400, "Enter your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email");
    const files: { kind: DocKind; filename: string; buf: Buffer }[] = [];
    for (const kind of KINDS) {
      for (const v of form.getAll(kind)) {
        if (v instanceof File && v.size > 0) files.push({ kind, filename: v.name, buf: Buffer.from(await v.arrayBuffer()) });
      }
    }
    return createCampaign({
      organizer: { name, email, relationship: s("relationship") || "Family" },
      providerId: s("providerId"),
      title: s("title"),
      story: s("story").slice(0, 3000),
      files,
    });
  });
}
