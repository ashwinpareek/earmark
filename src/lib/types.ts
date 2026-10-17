// Earmark domain model.
//
// A Campaign raises money for one patient's treatment at one VERIFIED provider (hospital).
// Donations are PayPal authorizations: money is held on the donor's account, never taken
// up front. When the provider submits the final bill, Earmark reconciles it against the
// verified estimate, captures from each donor only their fair share of the verified amount,
// voids the rest, and pays the provider directly. The organizer never touches the money.

export type Role = "donor" | "organizer" | "hospital" | "reviewer";

export type ProviderType = "hospital" | "clinic" | "pharmacy" | "medical_supplies";

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  city: string;
  country: string;
  registrationNo: string;
  phone: string;
  address: string;
  paypalEmail: string; // payee — money only ever goes here
  verifiedSince: string;
}

export type DocKind = "estimate" | "identity" | "medical_note" | "final_bill" | "receipt";

export interface LineItem {
  description: string;
  quantity: number;
  amount: number; // line total in document currency
}

/** What the Document Reader extracted from a document. Every field is as printed, unverified. */
export interface Extraction {
  docType: "estimate" | "invoice" | "receipt" | "identity" | "medical_note" | "other";
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
  /** Where key fields are printed, as [ymin, xmin, ymax, xmax] on a 0–1000 scale (for evidence boxes). */
  evidence?: { field: EvidenceField; box: [number, number, number, number] }[];
}

export type EvidenceField = "total" | "documentNumber" | "documentDate" | "patientName" | "patientAge" | "patientDob" | "providerPhone" | "providerRegistrationNo" | "instructionsToReader";

export interface Doc {
  id: string;
  kind: DocKind;
  filename: string;
  mime: string;
  sha256: string;
  size: number;
  uploadedAt: string;
  uploadedBy: Role;
  phash?: string; // visual fingerprint (images only), catches re-saved and re-scanned copies
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
  refs?: { campaignId: string; label: string }[]; // other campaigns involved (reuse radar)
}

export interface VerificationReport {
  // Rules never reject on their own: anything that fails is HELD for a person to review,
  // with the evidence, and the family can respond. Only a human reviewer rejects.
  decision: "verified" | "needs_review" | "rejected";
  risk: "low" | "medium" | "high";
  verifiedGoal: number; // amount the documents actually support
  checks: Check[];
  summary: string;
  at: string;
  /** The AI investigator's write-up for the reviewer. It explains; it never decides. */
  notes?: { text: string; model: string };
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
  status: "pending" | "held" | "captured" | "voided" | "lapsed" | "failed";
  problem?: string; // why a hold couldn't be collected
  orderId?: string;
  authorizationId?: string;
  authorizationExpiresAt?: string;
  authorizedAt?: string;
  reauthorizedAt?: string; // PayPal allows renewing a hold once its 3-day honor period has passed
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

/** A capped allowance for verified out-of-hospital care costs (medicines, supplies),
 *  paid directly to the verified issuer of the receipt — never to the family. */
export interface CareCost {
  id: string;
  docId: string;
  providerId: string | null;
  issuer: string;
  claimed: number;
  eligible: number; // medical lines, capped — what a reviewer can release if the receipt was held
  approved: number; // what will actually be paid (0 while held)
  status: "approved" | "held" | "paid";
  checks: Check[];
  note: string;
  at: string;
}

export interface MoneyMovement {
  id: string;
  type: "hold" | "capture" | "void" | "payout";
  payee?: string;
  ref?: string; // payout sender_item_id, to match PayPal's per-item webhooks
  /** Set only when PayPal itself confirms the movement — by signed webhook or by reading it
   *  back from the PayPal API. Until then the ledger shows it as "requested". */
  confirmed?: { at: string; via: "webhook" | "api" | "mock"; status?: string };
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
  /** "main" for real campaigns; "demo_xxx" for a judge's private demo space. Reuse detection,
   *  lists and the radar are scoped to a space, so judges never see each other's demo runs. */
  space?: string;
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
  careCosts: CareCost[];
  organizerResponse?: { text: string; at: string };
  lab?: boolean; // a Forgery Lab attempt
  settlingSince?: string; // settlement claim (lock)
  protectedCopies?: number; // times this campaign's documents were caught being reused elsewhere
  settlement?: {
    payable: string;
    captured: string;
    neverCharged: string;
    payoutBatchId?: string;
    payoutStatus?: string;
    payees?: { name: string; amount: string }[];
    lapsed?: number; // holds that could no longer be collected
    shortfall?: string; // payable amount that pledges couldn't cover
    direct?: boolean; // captured straight into the provider's account (no payout step)
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
