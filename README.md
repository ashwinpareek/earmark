# Earmark

**Donations that can only pay the bill.**

Earmark is verified medical fundraising on PayPal.
- **Before a campaign goes live**, an AI reads the hospital's documents and plain rules check them.
- **Each donation is a PayPal hold, not a charge.**
- **When the hospital submits its final bill**, Earmark checks it against the verified estimate.
- **Every donor pays the same fair share** of what the bill actually needs, plus up to 10% for verified pharmacy receipts.
- **The money goes straight to verified providers.** The rest of every pledge is released and **never charged**.
- **The family never handles the money**, and neither does the platform.

> Medical crowdfunding raises hundreds of millions of dollars a year on trust alone. Fake campaigns follow a recurring pattern: no hospital named, a target that triples after launch, organizers who disappear, and copies of real families' campaigns. Verification usually happens only after someone complains. Platforms that pay hospitals directly still take donors' money up front. Earmark removes the trust step altogether.

---

## Try it in two minutes

Open the app and work through the three demo campaigns on the home page, then the **Reuse radar** and the **Ledger**.

**1. Maya, a genuine campaign**
- Her estimate, registration card and doctor's note pass all **9 checks**. The goal is the hospital's verified **$2,400**.
- Pledge with PayPal (sandbox). The money is *held*, not charged.
- **Family** view → *Use the sample pharmacy receipt*:
  - CityCare Pharmacy is a verified provider;
  - the get-well balloon isn't medical care, so it's excluded;
  - **$64.50** is approved, inside the 10% cap.
- **Hospital** view → *Use the sample final bill*:
  - the $45 family parking pass is excluded;
  - the bill comes in **$105 under** the estimate.
- Every donor pays the same **90.8%** of their pledge:
  - **$2,295** goes to the hospital and **$64.50** to the pharmacy, both paid directly;
  - **$240.50** is never charged;
  - **$0** goes to the family.
- Each donor gets a receipt with PayPal IDs.

**2. Leo, a doctored campaign.** It goes **on hold** with 5 failed checks, each with its evidence:
- the line items add up to $3,150, but the printed total says **$9,850**;
- the phone and licence number don't match the hospital registry;
- the estimate number was **reused** from Maya's campaign;
- the patient is "7" on the estimate, but the ID says born in 1991;
- a near-invisible note tells the AI to approve it.

Nobody can pledge. The family can respond, and a reviewer decides.

**3. The copycat**
- A stranger uploads Maya's *real* documents to raise money for themselves.
- One check catches it: the files are an exact copy, and the radar links the two campaigns.
- Maya's page shows **"Protected: Earmark caught 2 copies of this campaign's documents."**

**Rules never reject anyone.** A failed check *holds* a campaign with its evidence, the family can explain, and only a person can reject. A real patient is never turned away by a model or a regex.

## How it works

```
Family uploads documents ─► Document Reader (multimodal AI) ─► Forensic rules ─► live | on hold (risk level)
                                                                                    │            │
                                                     family responds, reviewer decides ◄──────────┘
Donors pledge ─► PayPal Orders v2, intent=AUTHORIZE (held, not charged)
Family adds pharmacy receipts ─► Reader ─► rules + AI line classifier ─► capped 10% allowance
Hospital submits final bill ─► Reader ─► rules + estimate matching + AI line classifier ─► payable
Settlement (integer cents) ─► per-donor partial capture, final_capture=true releases the rest
                           ─► paid to verified providers only (see "Where the money goes")
```

### The AI reads; rules decide

| Step | AI | Deterministic code |
|---|---|---|
| Read documents | **Document Reader**: reads photos, scans or PDFs and transcribes what's *printed* (never "fixes" numbers). It also reports tamper signals and copies any text that addresses a reviewer | Zod validation, tolerant parsing |
| Verify a campaign | — | `forensics.ts`: provider vs registry, arithmetic to the cent, one patient across documents (name, age vs date of birth), reuse of a file or document number across *all* campaigns, dates, clinical support → live, or on hold with a risk level |
| Final bill | **Bill Line Classifier**: medical care for the verified treatment, or not | `reconcile.ts`: same rules, verified patient, line-by-line match to the estimate, covered growth > 15% → human review |
| Care receipts | Same classifier | `care.ts`: verified issuer, patient, arithmetic, reuse, capped at 10% of the goal |
| Move money | — | `settlement.ts`: largest-remainder allocation in integer cents. Everyone pays the same fraction, nobody is over-charged, and totals are exact (property-tested) |
| Answer donors | **Campaign Q&A**: answers only from verified facts | Facts are written by code from verified extractions |

**Safety:**
- Documents and questions are fenced as untrusted data.
- A document that talks to the AI is treated as fraud.
- A bill line the model skips is *not paid*.
- Money only moves to a provider's **registered** PayPal account, never to an address printed on a document.
- Donors never see raw medical documents. Public views are redacted.

### Where the money goes

Earmark supports two PayPal setups, chosen with `PAYEE_MODE`.

| Mode | How it works | Platform holds money? |
|---|---|---|
| `payout` (default) | Each donor's share is captured and paid out to the provider(s) in the **same settlement step** through **PayPal Payouts**: the hospital, plus any pharmacy with an approved receipt | Only for the seconds between capture and payout. There is no balance and no float |
| `direct` | Each pledge is created with the **hospital as the PayPal payee**, so captures land straight in the hospital's account | **Never.** Care receipts are disabled in this mode, because each hold is payable only to the hospital |

`direct` mode relies on PayPal's multiparty (approved partner) capabilities with the hospital onboarded as a seller, which is how this would run in production. Try it with `PAYEE_MODE=direct`. If your sandbox app isn't enabled for third-party payees, PayPal returns a permissions error and you can switch back to `payout`.

### PayPal integration

- **Orders v2**, `intent: AUTHORIZE`, with optional `purchase_units[].payee`, plus **JS SDK** donate buttons.
- **Authorizations**:
  - **partial capture** with `final_capture: true`, which automatically releases the uncaptured remainder of each hold;
  - **void** when a campaign is cancelled or a donor's share is zero.
- **Payouts**: one batch per settlement, with one item per provider.
- **Webhooks** with signature verification.
- `PayPal-Request-Id` idempotency on every write.
- Everything runs in the sandbox. A **mock mode** runs the app with no keys.

### Honest limits

- **Hold window:** PayPal holds an authorization for up to **29 days**, with a 3-day honor period. That fits urgent treatment. Longer treatments would settle bill by bill, renew holds by reauthorizing, or use PayPal's delayed disbursement.
- **Partial captures** must be enabled on the PayPal account that captures.
- **Providers must accept PayPal.** The registry covers hospitals, clinics, pharmacies and medical-supply stores. Bank-transfer payouts to providers without PayPal are future work.
- **No login in the demo:** roles are switched in the UI, and the provider registry is a fixed list of fictional providers.

---

## Run it locally (5 minutes)

**You need:** Node 20+, a free PayPal developer account, and one AI key that can read images. A free Gemini key works.

```bash
git clone https://github.com/ashwinpareek/earmark.git
cd earmark
npm install
cp .env.example .env      # fill in the values below
npm run dev               # http://localhost:3000
```

1. **PayPal sandbox app.**
   1. At [developer.paypal.com](https://developer.paypal.com/dashboard/), switch to **Sandbox**.
   2. Open **Apps & Credentials**, choose **Create App** (Merchant), and copy the **Client ID** and **Secret** into `.env`.
   3. Make sure **Payouts** is ticked.
2. **Payees.** Create a sandbox **Business** account under **Testing Tools → Sandbox Accounts** and put its email in `PROVIDER_PAYPAL_EMAIL`. Pharmacy payouts go there too unless you set `PHARMACY_PAYPAL_EMAIL`.
3. **Donor login.** Log in with the default sandbox **Personal** account in the PayPal popup.
4. **AI.** Set `GEMINI_API_KEY` ([free](https://aistudio.google.com/apikey)), or `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`.
5. *(Optional)* `AG_STUDIO_LICENSE` removes the ledger watermark. `PAYEE_MODE=direct` tries the direct-payee setup.

**Fallback modes:**
- With no PayPal keys the app runs in **mock mode**, with simulated holds and a "simulated donors" button.
- With no AI key, the bundled sample documents use a labelled answer key.
- A banner shows whenever a fallback is active.

**Webhooks (optional).** Point a sandbox webhook to `https://<host>/api/paypal/webhook` for these events, and set `PAYPAL_WEBHOOK_ID`:
- `PAYMENT.AUTHORIZATION.CREATED`
- `PAYMENT.AUTHORIZATION.VOIDED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`
- `PAYMENT.PAYOUTS-ITEM.FAILED`

**Deploy on Render.** Use `render.yaml`: **New → Blueprint**, then fill in the secrets.

### Tests

```bash
npm test
```

There are 20 tests:
- **Settlement maths:** exact totals, fair shares, rounding, and 300 randomised invariant cases.
- **The rules on the real sample documents:** genuine passes; doctored is held for exactly the right reasons; the copycat is caught and linked to the original.
- **Care receipts:** balloon excluded, unverified shop held.
- **Bill reconciliation.**
- **The AI code paths, with a stubbed model.**

## Project map

```
src/lib/
  reader.ts        Document Reader — multimodal extraction (Anthropic / OpenAI / Gemini)
  forensics.ts     Campaign checks with evidence; hold-for-review decisions and risk levels
  reconcile.ts     Final-bill review
  care.ts          Capped care-cost receipts paid to verified pharmacies and suppliers
  settlement.ts    Fair-share allocation in integer cents
  agents.ts        Bill line classifier, campaign Q&A
  workflow.ts      State machine, settlement, reuse alerts, reuse radar
  paypal.ts        Orders v2 authorize (optional payee), capture, void, multi-item Payouts, webhooks
  providers.ts     Verified provider registry (hospitals, clinics, pharmacies, medical supplies)
  views.ts         Role-based redaction (donor / family / provider / reviewer)
src/app/           Landing, start, campaign (+ receipts), radar, providers, review, ledger (AG Studio)
scripts/make-samples.py   Generates the fictional demo documents
```

## Built with

- **PayPal:** Orders v2, Authorizations, Payouts, Webhooks, JS SDK.
- **AI:** Gemini, Claude or GPT.
- **AG Studio + AG Grid:** the transparency ledger.
- **Render:** hosting.
- **Next.js 15, React 19, TypeScript, Zod.**

Every person, provider and document in the demo is fictional.

## License

MIT. See [LICENSE](LICENSE).
