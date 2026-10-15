// Earmark domain model.
//
// A Campaign raises money for one patient's treatment at one VERIFIED provider (hospital).
// Donations are PayPal authorizations: money is held on the donor's account, never taken
// up front. When the provider submits the final bill, Earmark reconciles it against the
// verified estimate, captures from each donor only their fair share of the verified amount,
// voids the rest, and pays the provider directly. The organizer never touches the money.

export type Role = "donor" | "organizer" | "hospital" | "reviewer";

export interface Provider {
  id: string;
  name: string;
  city: string;
  country: string;
  registrationNo: string;
  phone: string;
  address: string;
  paypalEmail: string; // payee — money only ever goes here
  verifiedSince: string;
}

export type DocKind = "estimate" | "identity" | "medical_note" | "final_bill";

export interface LineItem {
  description: string;
  quantity: number;
  amount: number; // line total in document currency
}

/** What the Document Reader extracted from a document. Every field is as printed, unverified. */
export interface Extraction {
  docType: "estimate" | "invoice" | "identity" | "medical_note" | "other";
  providerName: string;
  providerAddress: string;
  providerPhone: string;
  providerRegistrationNo: string;
  patientName: string;
  patientAge: number | null;
  patientDob: string;
  documentNumber: string;
  documentDate: string; // YYYY-MM-DD if readable
  procedure: string;
  diagnosis: string;
  currency: string;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  insuranceCovered: number | null;
  total: number | null; // amount the patient/family owes as printed
  tamperSignals: string[]; // visual anomalies the model noticed (fonts, alignment, overwrites)
  instructionsToReader: string; // any text that addresses an AI/reviewer (prompt injection)
  readerConfidence: number; // 0..1
}

export interface Doc {
  id: string;
  kind: DocKind;
  filename: string;
  mime: string;
  sha256: string;
  size: number;
  uploadedAt: string;
  uploadedBy: Role;
  extraction?: Extraction;
  readerModel?: string;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string; // stable code, e.g. "arithmetic", "duplicate"
  label: string; // short human label
  status: CheckStatus;
  detail: string; // concrete evidence
  docIds: string[];
  source: "rule" | "ai"; // deterministic rule or AI judgement
}

export interface VerificationReport {
  decision: "verified" | "needs_review" | "rejected";
  verifiedGoal: number; // amount supported by the documents
  checks: Check[];
  summary: string;
  at: string;
}

export type CampaignStatus =
  | "verifying"
  | "needs_review" // a human reviewer must look before it goes live
  | "rejected"
  | "live" // accepting donations (holds)
  | "bill_review" // final bill submitted, reconciling
  | "bill_needs_review"
  | "settling"
  | "settled"
  | "cancelled";

export interface Donation {
  id: string;
  donorName: string;
  donorEmail: string;
  anonymous: boolean;
  message: string;
  pledged: string; // decimal string
  status: "pending" | "held" | "captured" | "voided" | "failed";
  orderId?: string;
  authorizationId?: string;
  authorizationExpiresAt?: string;
  captured?: string;
  neverCharged?: string;
  captureId?: string;
  createdAt: string;
}

export interface BillLineReview {
  description: string;
  amount: number;
  estimateAmount: number | null; // matched estimate line, if any
  covered: boolean; // payable from donations?
  reason: string;
}

export interface BillReview {
  docId: string;
  decision: "approve" | "needs_review" | "reject";
  billTotal: number;
  payable: number; // what donations may pay (covered lines, capped)
  lines: BillLineReview[];
  checks: Check[];
  explanation: string; // donor-facing, plain English
  model: string;
  at: string;
}

export interface MoneyMovement {
  id: string;
  type: "hold" | "capture" | "void" | "payout";
  amount: string;
  currency: string;
  paypalId: string;
  status: string;
  donationId?: string;
  note?: string;
  at: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  actor: Role | "ai" | "paypal" | "system";
  kind: string;
  message: string;
}

export interface Campaign {
  id: string;
  createdAt: string;
  status: CampaignStatus;
  currency: string;
  organizer: { name: string; email: string; relationship: string };
  providerId: string;
  patient: { displayName: string; age: number | null }; // public, redacted
  title: string;
  story: string; // organizer's words
  facts: string[]; // AI-written, only from verified documents
  goal: string; // verified estimate amount
  docs: Doc[];
  verification?: VerificationReport;
  donations: Donation[];
  billReview?: BillReview;
  settlement?: {
    payable: string;
    captured: string;
    neverCharged: string;
    payoutBatchId?: string;
    payoutStatus?: string;
    at: string;
  };
  movements: MoneyMovement[];
  events: TimelineEvent[];
  reviewerNote?: string;
}

export interface QA {
  answer: string;
  basedOn: string[]; // check ids or fact indexes used
  model: string;
}
