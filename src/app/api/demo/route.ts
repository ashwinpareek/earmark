import { viewFor } from "@/lib/views";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { handle } from "@/lib/http";
import { confirmDonation, createCampaign, createDonationOrder, listCampaigns } from "@/lib/workflow";
import { paypalMode } from "@/lib/paypal";
import { ensureDemoSpace } from "@/lib/space";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const file = async (name: string) => Buffer.from(await fs.readFile(path.join(process.cwd(), "public", "samples", name)));

async function honest(space: string) {
  return createCampaign({
    space,
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

// A second verified family at the same hospital, partly funded. When Maya's bill comes in lower
// than her pledges, donors who asked for it are offered Aarav, as a new PayPal hold.
async function ensureAarav(space: string) {
  if ((await listCampaigns([space])).some((c) => c.docs.some((d) => d.filename === "aarav-estimate.png"))) return;
  const c = await createCampaign({
    space,
    organizer: { name: "Priya Shah", email: "priya.shah@example.com", relationship: "Mother" },
    providerId: "prov_riverside",
    title: "Help Aarav breathe and sleep again",
    story: "Aarav stops breathing for seconds at a time in his sleep. His doctors say removing his tonsils and adenoids will fix it. Insurance pays most of the cost; this is the part we can't cover. Every gift goes straight to Riverside Children's Hospital.",
    files: [
      { kind: "estimate", filename: "aarav-estimate.png", buf: await file("aarav-estimate.png") },
      { kind: "identity", filename: "aarav-registration.png", buf: await file("aarav-registration.png") },
    ],
  });
  if (c.status !== "live" || paypalMode() !== "mock") return;
  for (const [name, amt] of [["Neighbours on Cedar St.", "650.00"], ["Dev", "300.00"], ["Aunt Meera", "250.00"]]) {
    const o = await createDonationOrder(c.id, { donorName: name, donorEmail: `${name.split(" ")[0].toLowerCase()}@example.com`, amount: amt, anonymous: false, message: "" });
    await confirmDonation(c.id, o.donationId, o.orderId);
  }
}

async function fraud(space: string) {
  // The doctored estimate re-uses Maya's estimate number, so make sure that campaign exists.
  if (!(await listCampaigns([space])).some((c) => c.docs.some((d) => d.filename === "maya-estimate.png"))) await honest(space);
  return createCampaign({
    space,
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

// A stranger copies a real family's campaign: Maya's estimate cropped and re-saved as a JPEG
// (so its SHA-256 is different), plus her registration card as-is, under a different organizer.
async function copycat(space: string) {
  if (!(await listCampaigns([space])).some((c) => c.docs.some((d) => d.filename === "maya-estimate.png"))) await honest(space);
  return createCampaign({
    space,
    organizer: { name: "M. Kahn", email: "maya.rodriguez.help@example.org", relationship: "Friend" },
    providerId: "prov_riverside",
    title: "Please help little Maya pay for her surgery",
    story: "I'm raising money for Maya's surgery on behalf of her family. Every dollar helps!",
    files: [
      { kind: "estimate", filename: "estimate.jpg", buf: await file("copycat-estimate.jpg") },
      { kind: "identity", filename: "id.png", buf: await file("maya-registration.png") },
    ],
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { scenario } = z.object({ scenario: z.enum(["honest", "fraud", "copycat"]) }).parse(await req.json());
    // Every visitor gets a private demo space, so judges never collide with each other.
    const space = await ensureDemoSpace();
    if (scenario === "honest") {
      // One genuine Maya per space: reopen it instead of making a "copy" that would be flagged.
      const existing = (await listCampaigns([space])).find((c) => c.docs.some((d) => d.filename === "maya-estimate.png"));
      const maya = existing ?? (await honest(space));
      await ensureAarav(space).catch(() => undefined);
      return viewFor(maya, "organizer");
    }
    return viewFor(scenario === "fraud" ? await fraud(space) : await copycat(space), "organizer");
  });
}
