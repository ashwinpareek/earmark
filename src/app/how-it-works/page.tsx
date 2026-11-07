import Link from "next/link";
import ScanScene from "@/components/ScanScene";
import MoneyPath from "@/components/MoneyPath";

export const metadata = { title: "How it works — Earmark", description: "How Earmark verifies hospital documents with Gemini and plain rules, holds every gift on PayPal, and pays only the hospital. Plus its limits and safeguards." };

// The technical story and the honest limits, moved off the home page so donors aren't
// buried in detail. Everything that animates on the home page animates here too.

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Who can see the hospital documents?", a: <>Donors never see them: the donor view only shows what was verified. The family, the hospital and Earmark&apos;s reviewers can open them. Each file is stored once, under a fingerprint of its contents, and is only served to those roles. <b>In this demo</b>, roles switch with a toggle and there is no real sign-in, so judges can see every view. A real deployment adds sign-in for families, hospitals and reviewers, encrypts documents at rest, and deletes them after the bill is settled and any legal retention period ends.</> },
  { q: "Does the AI see patient data?", a: <>Yes: Gemini reads the documents in order to extract the facts. <b>In this demo</b> that uses Google&apos;s Gemini API. A real deployment would use a paid tier whose data isn&apos;t used for training, under a data-processing agreement, and would send only the pages that need reading. The AI never decides anything: plain code makes every decision, and only code moves money.</> },
  { q: "What if a hospital and a patient collude?", a: <>Documents alone can&apos;t stop that, so Earmark doesn&apos;t rely on documents for the hospital&apos;s identity. Hospitals come from Earmark&apos;s own registry, checked when they join. The confirmation goes to the billing contact in that registry, never a phone number or email printed on the paper. Money is only paid to the registry&apos;s PayPal account. A colluding hospital would be confirming a false bill in its own name, to an auditable public ledger. Bills that grow more than 15% over the verified estimate go to a human reviewer.</> },
  { q: "How long can a pledge stay on hold?", a: <>A PayPal authorization is guaranteed for 3 days and can stay valid for up to 29. Earmark renews holds before the 3-day point, and shows each campaign&apos;s deadline. That suits urgent care. Longer treatments settle bill by bill, and if a hold expires, the pledge simply lapses: nothing is ever charged.</> },
  { q: "What if the bill is lower, or the treatment doesn't happen?", a: <>Lower bill: every donor pays the same fair share of the real bill, and the rest is released automatically. No treatment: the family can cancel, or the holds expire, and every pledge is released. Nobody has to ask for a refund, because nothing was charged.</> },
  { q: "What if a payout to the hospital fails?", a: <>The money has already been captured, so Earmark records the failed payout, shows it on the campaign and the public ledger, and retries to the same registry account. It is never redirected to anyone else.</> },
  { q: "What is real here, and what is simulated?", a: <>Real: every PayPal call (holds, fair-share captures, releases and Payouts batches on the PayPal sandbox), Gemini reading the documents, and every check. Simulated: the patients, hospitals and documents are fictional, the money is sandbox money, and the hospital&apos;s confirmation of the final bill is played by the hospital view. In production that confirmation comes from the hospital&apos;s billing office.</> },
  { q: "Isn't this slower for families in an emergency?", a: <>Checks take seconds, and a failed check never rejects anyone: it puts the campaign on hold with the evidence for a person to decide, and the family can explain. Pledges start immediately, as holds. The family never has to handle the money or prove where it went, which removes work rather than adding it.</> },
];

export default function HowItWorks() {
  return (
    <>
      <div className="wrap how-head">
        <h1>How Earmark works</h1>
        <p className="lede">Gemini reads the hospital&apos;s documents. Plain rules check every claim. PayPal holds every gift and pays only the bill the hospital confirms. Here is each part, and the limits we&apos;re honest about.</p>
        <nav className="how-toc" aria-label="On this page">
          <a href="#money">Where the money goes</a><a href="#built">PayPal and AI</a><a href="#checks">The ten checks</a><a href="#limits">Limits and safeguards</a>
        </nav>
      </div>
      <div className="wrap">
        <section className="band money-band" aria-labelledby="money">
          <div>
            <h2 id="money">Where the money goes</h2>
            <p className="intro">Real proportions from Maya&apos;s campaign on the PayPal sandbox.</p>
          </div>
          <MoneyPath picker hospital="Riverside Children's" share={0.9495} caption="Every one of Maya's six donors paid the same 94.95% of their pledge." />
        </section>
      <section className="duo" aria-labelledby="built">
        <h2 id="built" className="sr">What Earmark is built on</h2>
        <div className="duo-card pp">
          <span className="duo-tag">PayPal moves the money</span>
          <p className="duo-lead">Holds, fair shares and payouts. Every cent is a PayPal object you can look up.</p>
          <ul>
            <li><b>Orders v2 authorizations</b> hold each pledge without charging it</li>
            <li><b>Partial capture</b> collects only each donor&apos;s fair share; the rest is released</li>
            <li><b>Payouts</b> pay the registry-verified hospital, never the family</li>
            <li><b>Agent Toolkit</b> lets any donor ask PayPal to confirm their receipt</li>
          </ul>
        </div>
        <div className="duo-card ai">
          <span className="duo-tag">AI reads the paperwork</span>
          <p className="duo-lead">The AI reads and explains. Plain rules decide. Only code moves money.</p>
          <ul>
            <li><b>Gemini</b> reads bills, estimates and phone photos</li>
            <li><b>Points at every forged value</b> with a box on the page</li>
            <li><b>Writes the reviewer&apos;s case notes</b> with the evidence</li>
            <li><b>An auditor agent</b> answers questions from the public ledger</li>
          </ul>
        </div>
      </section>

      <p className="fine wide-fine">
        Medical crowdfunding runs on trust: fake campaigns borrow real children&apos;s photos, inflate the target and keep the money. Earmark removes
        the trust step. An AI reads the hospital&apos;s documents, plain rules check every claim, and PayPal holds make sure the money can only ever
        reach the verified bill.
      </p>


      <section className="band wide" aria-labelledby="checks">
        <div>
          <h2 id="checks">What Earmark checks</h2>
          <p className="intro">Gemini reads the page. Plain rules decide, and every result points at its evidence. Watch the same scan catch a forged copy.</p>
        </div>
        <ScanScene />
      </section>

        <section className="band" aria-labelledby="limits">
          <div>
            <h2 id="limits">Limits and safeguards</h2>
            <p className="intro">The questions a careful judge, donor or hospital should ask, answered plainly.</p>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <p className="fine wide-fine"><Link href="/lab">Try to forge a bill</Link> · <Link href="/ledger">See the money on the public ledger</Link> · <Link href="/agent">Meet the Giving Agent</Link></p>
      </div>
    </>
  );
}
