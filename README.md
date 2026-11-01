# Earmark

**The best a scammer can do is pay a stranger's hospital bill.**

**[Try to forge a bill →](#the-forgery-lab)** Open `/lab`, edit a real hospital estimate in your browser, and try to raise money with it.

Earmark is verified medical fundraising on PayPal.
- **Before a campaign goes live**, an AI reads the hospital's documents and plain rules check them.
- **Each donation is a PayPal hold, not a charge.**
- **When the hospital submits its final bill**, Earmark checks it against the verified estimate.
- **Every donor pays the same fair share** of what the bill actually needs, plus up to 10% for verified pharmacy receipts.
- **The money goes straight to verified providers.** The rest of every pledge is released and **never charged**.
- **The family never handles the money**, and neither does the platform.

> Medical crowdfunding raises hundreds of millions of dollars a year on trust alone. Fake campaigns follow a recurring pattern: no hospital named, a target that triples after launch, organizers who disappear, and copies of real families' campaigns. Verification usually happens only after someone complains. Platforms that pay hospitals directly still take donors' money up front. Earmark removes the trust step altogether.

---

## The Forgery Lab

The fastest way to understand Earmark is to attack it. `/lab` gives you Maya's real estimate from Riverside Children's Hospital. You can forge it however you like:
- inflate the total;
- raise a line item **and** the total together, so the sums still work;
- put another patient's name on it;
- swap the hospital's phone number for your own;
- hide a near-invisible note telling the AI to approve it;
- crop and re-save it so the file is different.

Then you submit it as your own campaign. A case file opens step by step and ends in a stamp:
- the hospital is checked against the registry;
- every line is added up;
- **the hospital's billing office is asked directly**;
- every document Earmark has seen is searched;
- edits and hidden text are looked for;
- the AI investigator writes notes for the reviewer.

A public scoreboard counts every attempt: *forgeries submitted · held · amount forgers asked for · **paid to forgers: $0.00***.

The third line of defence is why that last number is always zero. Even a forgery that beats every check can only collect PayPal holds that are captured for a bill **the hospital submits**, and the money is paid to **the hospital's registered PayPal account**. The best a forger can achieve is paying Maya's real bill.

> With an AI key, the model reads your forged pixels like any upload, and looks for mismatched fonts and painted-over values. Without one, the Lab applies your edits to Maya's answer key, says so on the case file, and the same rules decide.

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
  - **$0** goes to the family, and **$0** is kept by Earmark.
- Each donor gets a receipt with PayPal IDs.
- **Pass it on.** Grace, Mei and the coworkers chose *"Offer me another verified patient"* when they pledged. Their receipts now offer **Aarav**, another verified patient at the same hospital: *Give up to $58.65 to Aarav*. Clicking opens a **new** PayPal hold for Aarav. Everyone else's unused amount simply stays uncharged.

**2. Leo, a doctored campaign.** It goes **on hold** with 5 failed checks, each with its evidence:
- the line items add up to $3,150, but the printed total says **$9,850**;
- the phone and licence number don't match the hospital registry;
- the estimate number was **reused** from Maya's campaign;
- the patient is "7" on the estimate, but the ID says born in 1991;
- a near-invisible note tells the AI to approve it.

Nobody can pledge. In the **Reviewer** view, **Where the problems are** draws a box over each printed value a check disagreed with and enlarges it; **X-ray** makes the hidden note readable. The family can respond, and a reviewer decides.

**3. The copycat**
- A stranger uploads Maya's *real* documents to raise money for themselves. The estimate is **cropped and re-saved as a JPEG**, so its bytes and SHA-256 are different.
- One check still catches it: Earmark's **visual fingerprint** recognises the same page (98% match), the estimate number is reused, and the registration card is an exact copy. The radar links the campaigns.
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
| Verify a campaign | — | `forensics.ts`: provider vs registry, arithmetic to the cent, one patient across documents (name, age vs date of birth), reuse across *all* campaigns (same file, same page re-saved via `phash.ts`, or same document number), dates, clinical support → live, or on hold with a risk level |
| Show the evidence | Reader also returns **where** each key field is printed (0–1000 boxes) | The UI boxes only the fields a failed rule names; the rule, not the box, decides |
| Final bill | **Bill Line Classifier**: medical care for the verified treatment, or not | `reconcile.ts`: same rules, verified patient, line-by-line match to the estimate, covered growth > 15% → human review |
| Care receipts | Same classifier | `care.ts`: verified issuer, patient, arithmetic, reuse, capped at 10% of the goal |
| Move money | — | `settlement.ts`: largest-remainder allocation in integer cents. Everyone pays the same fraction, nobody is over-charged, and totals are exact (property-tested) |
| Answer donors | **Campaign Q&A**: answers only from verified facts | Facts are written by code from verified extractions |
| Brief the reviewer | **Investigator notes**: a case summary written after the rules decide | The verdict is final before the notes are written |
| Ask the ledger | **Earmark auditor**, a custom agent built on AG Studio's Agent Framework, fronts the AI panel. It has two tools of its own (`open_case_file`, `trace_pledge`) plus Studio's query tools, and delegates dashboard changes to Studio's built-in lead agent. Turns are proxied through `/api/studio-ai`, so the key stays server-side | Read-only: the auditor and Studio's tools only change the dashboard view; nothing can touch money |

**Safety:**
- **Enforced by a test, not a promise.** `tests/boundary.test.ts` reads the import graph of the source on every run: no module that talks to an AI model can reach the PayPal client, even indirectly; only the workflow calls capture, void, reauthorize or payout; and the ledger assistant can't reach the workflow or PayPal. (It caught one real leak: the shared error handler imported both clients just for their error types.)
- Documents and questions are fenced as untrusted data.
- A document that talks to the AI is treated as fraud.
- A bill line the model skips is *not paid*.
- Money only moves to a provider's **registered** PayPal account, never to an address printed on a document.
- Donors never see raw medical documents. Public views are redacted.
- Earmark stores no PayPal payer data (name, email or address from PayPal); a donor's receipt uses only what they typed when pledging.

### Where the money goes

Earmark supports two PayPal setups, chosen with `PAYEE_MODE`.

| Mode | How it works | Platform holds money? |
|---|---|---|
| `payout` (default) | Each donor's share is captured and paid out to the provider(s) in the **same settlement step** through **PayPal Payouts**: the hospital, plus any pharmacy with an approved receipt | Only for the seconds between capture and payout. There is no balance and no float |
| `direct` | Each pledge is created with the **hospital as the PayPal payee**, so captures land straight in the hospital's account | **Never.** Care receipts are disabled in this mode, because each hold is payable only to the hospital |

`direct` mode relies on PayPal's multiparty (approved partner) capabilities with the hospital onboarded as a seller, which is how this would run in production. Try it with `PAYEE_MODE=direct`. If your sandbox app isn't enabled for third-party payees, PayPal returns a permissions error and you can switch back to `payout`.

### What happens to the part a bill didn't need

A pledge is a hold on the donor's own PayPal, so the part the bill doesn't need was never Earmark's money. Earmark never takes it, keeps it or decides where it goes. The **donor** decides, when pledging:

- **Release the rest — don't charge me** (the default). `final_capture: true` closes the hold; the rest is never charged. If the donor never answers, this is what happens.
- **Offer me another verified patient.** Still never charged. After settlement, the receipt offers one verified campaign at the same hospital (closest to its goal first, a fixed public rule), for at most what the bill didn't need and at most what that patient still needs. Accepting opens a **new** PayPal order and authorization: a hold is approved for one payee and one purpose, so Earmark never re-points an old one. Offers close after 7 days, are used once, and skip leftovers under $5 that fees would eat.

Two guards stop surplus forming in the first place: pledges **close at the verified goal** (the pledge that crosses it may overshoot by up to 10%, a buffer for holds that lapse), and a fully pledged campaign points late donors to the next verified patient. Open offers count against a campaign's remaining need, so offers can never rebuild a surplus somewhere else. Logic: `src/lib/forward.ts`, tested in `tests/forward.test.ts`.

Why not "keep it for the patient's follow-up care"? A hold is only guaranteed for 3 days, the payee is fixed when it's created, and a leftover of known size invites a padded "follow-up" invoice. A follow-up bill is a new verified bill and a new pledge.

### PayPal integration

- **Orders v2**, `intent: AUTHORIZE`, with optional `purchase_units[].payee`, plus **JS SDK** donate buttons.
- **Authorizations**:
  - **partial capture** with `final_capture: true`, which automatically releases the uncaptured remainder of each hold;
  - **void** when a campaign is cancelled or a donor's share is zero.
- **Payouts**: one batch per settlement, with one item per provider.
- **Webhooks** with signature verification.
- `PayPal-Request-Id` idempotency on every write, with deterministic IDs, so a retried capture can't charge twice.
- **A hardened client** (`src/lib/paypal.ts`, tested against a fake PayPal in `tests/paypal-client.test.ts`): every call times out; network errors, 429 (honouring `Retry-After`) and 5xx are retried with backoff, but only for reads and idempotent writes; business errors like `AUTHORIZATION_VOIDED` are never retried; the OAuth token is fetched once for concurrent callers, a failed fetch isn't cached, and a 401 refreshes it once. These are the failure modes the APIMatic PayPal SDK audit flags in hand-written clients.
- **Checked with PayPal Doctor.** The integration was run through the checklist in PayPal's AI Toolkit; the report and the fixes it led to (INSTRUMENT_DECLINED restart, webhook de-duplication, CSRF guard, `debug_id` logging, a sandbox-only guard) are in [`docs/PAYPAL_DOCTOR.md`](docs/PAYPAL_DOCTOR.md).
- **Run end to end on the real PayPal sandbox.** Holds, a partial capture with the rest released, a Payouts batch to the hospital, and PayPal agreeing through its Agent Toolkit: object IDs and the receipt in [`docs/SANDBOX_RUN.md`](docs/SANDBOX_RUN.md).
- Everything runs in the sandbox. A **mock mode** runs the app with no keys.

### The second witness: PayPal's Agent Toolkit

Earmark's ledger is Earmark's word. So every receipt has **Don't trust us. Ask PayPal.**, and the Earmark auditor agent has an `ask_paypal` tool ("Does PayPal agree?"). Both ask PayPal directly through **PayPal's Agent Toolkit** (`@paypal/agent-toolkit`, the tool layer PayPal ships for AI agents) and compare PayPal's answer with the ledger, line by line: the hold's status, the amount collected, and that the rest of the hold was closed by the final capture (plus the payee, in direct mode). Code: `src/lib/witness.ts`; tests: `tests/witness.test.ts`.

The witness is read-only by construction. The toolkit can also create orders, pay them and refund them, and its `handleToolCall()` runs whatever tool name it's given, without checking the configured actions. So Earmark enforces its own allowlist of exactly one tool, `get_order`, accepts only real order IDs, and sets `sandbox: true` explicitly (the toolkit defaults to the live API). In mock mode the check replays Earmark's own record and is labelled *Mock*.

### Built to survive real-world failures

- **A pledge can't be collected?** Before collecting, Earmark re-checks every hold with PayPal (`GET /v2/payments/authorizations/{id}`).
  - An expired, voided or declined hold is marked *not collected*, and that donor isn't charged.
  - Its share is spread across the other pledges. Nobody ever pays more than they pledged.
  - Any remaining gap is shown as a **shortfall**, and the hospital is paid first. Settlement never crashes.
- **"Paid" means PayPal said so.** Each money movement starts as *requested*. It becomes *confirmed* only when a **signature-verified webhook** arrives:
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.AUTHORIZATION.*`
  - `PAYMENT.PAYOUTS-ITEM.*`, matched per item by `sender_item_id`

  For local runs with no public URL, **Check with PayPal now** reads each movement back from the API instead. Unverified webhooks are logged but can't confirm anything.
- **The server restarts?** With `DATABASE_URL` set (render.yaml creates Render Postgres), every campaign, ledger entry and uploaded document is stored in Postgres, so restarts, redeploys and free-plan sleeps lose nothing.
- **A hold gets old?** A daily GitHub Actions job (`.github/workflows/holds.yml` calls `/api/cron/holds`) renews each PayPal hold once its 3-day honor period has passed (PayPal only allows that from day 4). It also marks holds that expired, so the page never claims money that can't be collected.
- **Settled twice?** Settlement first claims the campaign atomically, so a double click or a second tab gets "already being settled". Every capture also carries a `PayPal-Request-Id`, so even a retried request can't charge twice.
- **The AI is down or out of quota?** AI calls time out after 45s. The bundled sample documents fall back to their answer key, bill lines fall back to keyword rules, and Q&A answers from verified facts. Only brand-new uploads need the AI.

### AG Studio

The public ledger (`/ledger`) is an AG Studio report with two pages (Money, Integrity), six related data sources, KPIs, a donut, stacked columns, grids and a pivot, themed to match Earmark.
- **Custom widget: Money trail** (`src/components/ledgerStudio.tsx`). It follows pledged money stage by stage (pledged → charged → hospital → pharmacies → never charged) and ends on *Paid to families $0.00 · Guarantee held*. It reads data through the widget API, so page filters and cross-filters apply.
- **Custom agent: Earmark auditor.** It is built with `directLlmRunner` alongside all five built-in agents, with custom tools defined through `api.defineAiTool`. Ask "Why is Leo's campaign on hold?" and it opens the case file and cites the failed checks. Ask "Trace Grace's $500" and it follows the hold, capture, release and payout with their PayPal IDs.

### Hosted demo for judges

- **Private demo spaces:** every visitor gets their own (a cookie). Demo campaigns, reuse detection, lists and the radar are scoped to it, so judges never see each other's runs or a finished campaign. **Reset my demo** (home page and radar) starts over.
- **Keep it awake:** Render's free plan sleeps after 15 idle minutes, and the cold start takes about a minute. For judging week, either:
  - switch `render.yaml` to `plan: starter`, or
  - set the repository variable `APP_URL` so `.github/workflows/keepalive.yml` pings `/api/status` every 10 minutes.

### Honest limits

- **Hold window:** PayPal holds an authorization for up to **29 days**, with a 3-day honor period. That fits urgent treatment. Longer treatments would settle bill by bill, renew holds by reauthorizing, or use PayPal's delayed disbursement.
- **After the 3-day honor period, a capture isn't guaranteed.** PayPal tries to honour it until day 29 but the donor's funds may no longer be available. That's why Earmark re-checks every hold before collecting and reports any shortfall instead of assuming the money is there.
- **Partial captures** must be enabled on the PayPal account that captures.
- **Payouts need an eligible sender.** PayPal must enable Payouts for the business account, and sending Payouts isn't available from every country (an India-based business can receive but not send them). Direct mode avoids Payouts entirely.
- **Hospital confirmation is simulated.** Real hospitals don't expose a "did you issue this?" API. `hospital.ts` simulates each registered hospital's billing system with the documents it really issued, and every check that uses it says "simulated". In production this is the billing office's portal or a phone call, made through contact details in Earmark's registry.
- **The visual fingerprint** catches re-saved, re-scanned and cropped copies. It doesn't catch a phone photo taken at a steep angle. Two genuine patients on the same hospital form can look 98% alike (a registration card is mostly template), so a look-alike counts as a copy only when it's about the same patient; a copy with the name edited is still caught by its reused document number or by the hospital's confirmation.
- **India:** PayPal stopped domestic payments in India in April 2021, so an Indian donor can't pay an Indian hospital through PayPal. Earmark's live shape there is cross-border: donors abroad, including the diaspora, paying a hospital's PayPal account directly. The demo runs in US dollars.
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
   2. Under **Testing Tools → Sandbox Accounts**, create a **United States** Business account for the platform. PayPal refuses Payouts from some countries' accounts (India sandbox accounts get `PAYOUT_NOT_AVAILABLE`).
   3. Open **Apps & Credentials**, choose **Create App**, pick that US business account, and copy the **Client ID** and **Secret** into `.env`.
   4. Make sure **Payouts** is ticked.
2. **Payees.** Create a second US sandbox **Business** account (the test hospital) under **Testing Tools → Sandbox Accounts** and put its email in `PROVIDER_PAYPAL_EMAIL`. Pharmacy payouts go there too unless you set `PHARMACY_PAYPAL_EMAIL`.
3. **Donor login.** Create a US sandbox **Personal** account and log in with it in the PayPal popup. If the generated password is refused, set your own under **View/edit account**.
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

There are 31 tests:
- **Settlement maths:** exact totals, fair shares, rounding, and 300 randomised invariant cases.
- **The rules on the real sample documents:** genuine passes; doctored is held for exactly the right reasons; the copycat is caught and linked to the original.
- **Care receipts:** balloon excluded, unverified shop held.
- **Bill reconciliation.**
- **The AI code paths, with a stubbed model**, including quota-exhausted fallbacks.
- **Lapsed holds** re-spread across the other pledges, and shortfalls reported.
- **An attack suite** (`tests/attacks.test.ts`): Maya's documents forged one way at a time, plus honest controls that must not be held.

| Case | Scenario | Outcome | Checks raised |
|---|---|---|---|
| Attack | Printed total inflated, line items left alone | HELD | arithmetic |
| Attack | Wrong hospital phone and licence (fake letterhead) | HELD | provider_contact |
| Attack | Estimate from a hospital other than the one chosen | HELD | provider_match |
| Attack | Child's age on estimate, adult's date of birth on ID | HELD | identity |
| Attack | Registration card for a different patient | HELD | identity |
| Attack | Exact copy of another campaign's files | HELD | duplicate |
| Attack | Another campaign's page, cropped and re-saved, new number | HELD | duplicate (visual), identity |
| Attack | Borrowed estimate number, new patient | HELD | duplicate |
| Attack | Hidden text telling the AI to approve | HELD | injection |
| Attack | Estimate dated in the future | HELD | dates |
| Attack | Consistent edit: one line and the total raised together | HELD | hospital_confirmed (the hospital's amount is $2,400) |
| Control | Maya's genuine documents | passes | — |
| Control | Same family re-opens its own campaign | passes | — |
| Control | Different family, same hospital and template | live with a note | clinical (no doctor's note) |
| Control | No clinical note uploaded | live with a note | clinical |

**Attacks held: 11 of 11. Honest controls wrongly held: 0 of 4.**

Also tested:
- **The Forgery Lab** (`tests/lab.test.ts`): the careful forger passes the arithmetic but the hospital catches it.
- **The daily hold monitor** (`tests/monitor.test.ts`): a hold is renewed once after its honor period, and an expired one lapses.

## How Earmark differs

| | Charges donors | Where the money goes | Checks |
|---|---|---|---|
| GoFundMe | Up front | The organizer's or beneficiary's bank | Mostly after a complaint; refunds via its guarantee |
| Milaap, Ketto | Up front | Some campaigns pay the hospital directly; surplus stays on the platform | Staff review of documents |
| Watsi | Up front | Vetted partner hospitals | Manual vetting of a closed partner network |
| **Earmark** | **Only the exact share of the verified bill, at settlement** | **Verified providers' registered PayPal accounts. Families: $0** | **Automated, evidence-backed checks before launch and on the final bill; cross-campaign reuse radar; humans decide holds** |

Earmark can also run as a layer under an existing platform: verification, holds and settlement, with the platform keeping its donors and pages.

## Project map

```
src/lib/
  reader.ts        Document Reader — multimodal extraction (Anthropic / OpenAI / Gemini)
  forensics.ts     Campaign checks with evidence; hold-for-review decisions and risk levels
  reconcile.ts     Final-bill review
  care.ts          Capped care-cost receipts paid to verified pharmacies and suppliers
  settlement.ts    Fair-share allocation in integer cents
  agents.ts        Bill line classifier, campaign Q&A, investigator notes
  hospital.ts      Out-of-band confirmation with the hospital's billing office (simulated)
  phash.ts         Visual fingerprint: recognises cropped and re-saved copies of a page
  lab.ts           Forgery Lab: the visitor's edits, and the offline reading of a forgery
  pg.ts            Optional Postgres persistence (state + uploaded documents)
  workflow.ts      State machine, settlement, reuse alerts, reuse radar, daily hold monitor
  paypal.ts        Orders v2 authorize (optional payee), capture, void, multi-item Payouts, webhooks
  providers.ts     Verified provider registry (hospitals, clinics, pharmacies, medical supplies)
  views.ts         Role-based redaction (donor / family / provider / reviewer)
src/app/           Landing, Forgery Lab, start, campaign (+ evidence, receipts), radar, providers, review,
                   ledger (AG Studio + "Ask the ledger" agents), api/studio-ai, api/cron/holds
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
