# Demo video script (target 2:50, hard limit 3:00)

**The hook is the Forgery Lab.** Open on a forgery, not on a donation form. Judges remember the moment they watched a scam get caught, and "paid to forgers: $0.00".

**Before recording:**
- Run with real sandbox keys, `GEMINI_API_KEY` and `PROVIDER_PAYPAL_EMAIL` set, so the AI reads your forged pixels.
- Start from an empty database.
- Make two or three sandbox pledges on Maya beforehand from different buyers. Choose **"Offer me another verified patient"** on at least one, so its receipt shows the Aarav offer. Opening Maya's demo also creates Aarav's verified campaign.
- Record at 1280×720 or higher, browser zoom 110%, no copyrighted music.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Home page headline: *"The best a scammer can do is pay a stranger's hospital bill."* | "Medical fundraising runs on trust, and scammers know it. They fake hospital bills, copy real families' campaigns, and keep the money. I built Earmark so that, even if a scam gets through, the best a scammer can do is pay a stranger's hospital bill." |
| 0:15–0:50 | **Forgery Lab.** Click the total on Maya's estimate and type $5,400. Click the surgeon fee and type $3,980, so the sums still work. Add the hidden note. Submit. | "Let's be the scammer. This is a real estimate from a campaign on Earmark. I'll raise the surgeon fee and the total by the same three thousand dollars, so the arithmetic still works, and hide a note telling the AI to approve it." |
| 0:50–1:20 | The case file reveals step by step: arithmetic passes ✓, **hospital: "its amount is $2,400"** ✕, reuse 99% visual match ✕, hidden instruction ✕. BLOCKED stamp, investigator notes, scoreboard "Paid to forgers $0.00" | "The sums add up, so a normal check passes. But Earmark asks the hospital's billing office directly, through its own registry and never the number on the document, and the hospital says this estimate was for $2,400. It also recognises Maya's page even after editing, and catches the hidden note. The AI wrote these notes, but plain rules made the decision." |
| 1:20–1:35 | **See the evidence on your forgery**: red boxes over the forged values, then X-ray | "A reviewer sees a box over every value that didn't add up. X-ray makes the hidden note readable." |
| 1:35–2:15 | Maya's real campaign: donor pledges $100 in the PayPal popup ("held, not charged"). **Hospital** → sample final bill (parking excluded). **Where the money went** + receipt | "Now the real family. Donations are PayPal holds, not charges. When the hospital submits its bill, Earmark checks it line by line and drops the parking pass. Then it partially captures every hold for exactly its fair share. The rest is released and never charged, and the money goes straight to the hospital and pharmacy. The family receives zero dollars." |
| 2:15–2:28 | Grace's receipt: "$58.65 released, never charged · Kept by Earmark $0.00" → **Give up to $58.65 to Aarav** → PayPal popup → Aarav's bar moves | "Grace's pledge wasn't fully needed, and she chose, when she pledged, to be offered someone else. One click, a brand-new PayPal hold, and it helps Aarav at the same hospital. Earmark never held her money, so only she could decide." |
| 2:28–2:40 | **Ledger** (AG Studio): "Paid to families $0.00". Click **Ask the ledger**, then the starter **"Does PayPal agree?"**: the auditor calls `ask_paypal` and PayPal's Agent Toolkit confirms Grace's pledge | "Everything is public in an AG Studio ledger, and you can ask it questions. And you don't have to trust us: the auditor asks PayPal itself, through PayPal's own Agent Toolkit, and PayPal confirms the ledger. The AI can read; it can never move money." |
| 2:40–2:50 | Back to the Lab scoreboard | "Try to forge a bill yourself: the link is below. So far, forgers have asked for thousands of dollars and been paid exactly nothing. Earmark: donations that can only pay the bill." |

**Tips:**
- Keep the Lab segment tight. The reveal animation is the show, so don't talk over the stamp.
- If time allows, show the sandbox Business account receiving the payout, to prove real sandbox money moved.
- Upload as **Public** on YouTube.
