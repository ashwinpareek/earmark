import type { Campaign, Role } from "./types";
import { provider } from "./providers";

// What each role may see. Donors (the public) never see raw documents, full names,
// document numbers that identify the patient, or other donors' emails.
// NOTE: this demo has no login — the role is chosen in the UI. In production each role
// is an authenticated account (organizer, hospital billing office, platform reviewer).

export function viewFor(c: Campaign, role: Role) {
  const p = provider(c.providerId);
  const base = { ...c, provider: p ? { id: p.id, name: p.name, city: p.city, country: p.country, verifiedSince: p.verifiedSince, registrationNo: p.registrationNo } : null };
  if (role !== "donor") return base;
  const full = c.docs.find((d) => d.kind === "estimate")?.extraction?.patientName ?? "";
  const scrub = (s: string) => (full ? s.split(full).join(c.patient.displayName) : s);
  return {
    ...base,
    organizer: { name: c.organizer.name, relationship: c.organizer.relationship, email: "" },
    docs: c.docs.map((d) => ({ id: d.id, kind: d.kind, uploadedAt: d.uploadedAt, uploadedBy: d.uploadedBy, readerModel: d.readerModel, filename: "", mime: d.mime, sha256: d.sha256.slice(0, 12), size: d.size })),
    verification: c.verification && { ...c.verification, checks: c.verification.checks.map((k) => ({ ...k, detail: scrub(k.detail) })) },
    billReview: c.billReview && { ...c.billReview, checks: c.billReview.checks.map((k) => ({ ...k, detail: scrub(k.detail) })) },
    careCosts: c.careCosts.map((k) => ({ ...k, note: scrub(k.note), checks: k.checks.map((x) => ({ ...x, detail: scrub(x.detail) })) })),
    organizerResponse: c.organizerResponse && { ...c.organizerResponse, text: scrub(c.organizerResponse.text) },
    donations: c.donations
      .filter((d) => d.status !== "pending")
      .map((d) => ({ ...d, donorEmail: "", donorName: d.anonymous ? "Anonymous" : d.donorName, orderId: undefined })),
    events: c.events.map((e) => ({ ...e, message: scrub(e.message) })),
  };
}

export type CampaignView = ReturnType<typeof viewFor>;

export const asRole = (r: string | null): Role => (r === "organizer" || r === "hospital" || r === "reviewer" ? r : "donor");
