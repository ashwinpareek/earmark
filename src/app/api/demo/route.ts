import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { handle } from "@/lib/http";
import { createCampaign, listCampaigns } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const file = async (name: string) => Buffer.from(await fs.readFile(path.join(process.cwd(), "public", "samples", name)));

async function honest() {
  return createCampaign({
    organizer: { name: "Elena Rodriguez", email: "elena.rodriguez@example.com", relationship: "Mother" },
    providerId: "prov_riverside",
    title: "Help Maya recover from emergency surgery",
    story:
      "Maya woke up with terrible stomach pain on a Sunday night and needed emergency surgery for appendicitis. Our insurance covers most of it, but our share is more than we can manage right now. Anything you can give goes straight to Riverside Children's Hospital. Thank you for being there for us.",
    files: [
      { kind: "estimate", filename: "maya-estimate.png", buf: await file("maya-estimate.png") },
      { kind: "identity", filename: "maya-registration.png", buf: await file("maya-registration.png") },
      { kind: "medical_note", filename: "maya-clinical-note.png", buf: await file("maya-clinical-note.png") },
    ],
  });
}

async function fraud() {
  // The doctored estimate re-uses Maya's estimate number, so make sure that campaign exists.
  if (!(await listCampaigns()).some((c) => c.docs.some((d) => d.filename === "maya-estimate.png"))) await honest();
  return createCampaign({
    organizer: { name: "J. Martin", email: "help.leo.fund@example.net", relationship: "Uncle" },
    providerId: "prov_riverside",
    title: "URGENT: Leo needs spinal surgery NOW",
    story: "Little Leo needs urgent spinal surgery and every hour counts. Please give whatever you can, the hospital won't operate until we pay in full. Share this with everyone!",
    files: [
      { kind: "estimate", filename: "leo-estimate.png", buf: await file("leo-estimate.png") },
      { kind: "identity", filename: "leo-registration.png", buf: await file("leo-registration.png") },
    ],
  });
}

// A stranger copies a real family's campaign: same documents, different organizer.
async function copycat() {
  if (!(await listCampaigns()).some((c) => c.docs.some((d) => d.filename === "maya-estimate.png"))) await honest();
  return createCampaign({
    organizer: { name: "M. Kahn", email: "maya.rodriguez.help@example.org", relationship: "Friend" },
    providerId: "prov_riverside",
    title: "Please help little Maya pay for her surgery",
    story: "I'm raising money for Maya's surgery on behalf of her family. Every dollar helps!",
    files: [
      { kind: "estimate", filename: "estimate.png", buf: await file("maya-estimate.png") },
      { kind: "identity", filename: "id.png", buf: await file("maya-registration.png") },
    ],
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { scenario } = z.object({ scenario: z.enum(["honest", "fraud", "copycat"]) }).parse(await req.json());
    return scenario === "honest" ? honest() : scenario === "fraud" ? fraud() : copycat();
  });
}
