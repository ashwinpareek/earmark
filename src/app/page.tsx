import Link from "next/link";
import HeroReceipt from "@/components/HeroReceipt";
import DemoButton from "@/components/DemoButtons";
import ResetDemo from "@/components/ResetDemo";
import LabScore from "@/components/LabScore";
import PledgeStory from "@/components/PledgeStory";
import Logo, { MARK } from "@/components/Logo";

export default function Home() {
  return (
    <>
    <section className="hx" aria-labelledby="hx-h">
      <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="wrap hx-grid">
        <div className="hx-copy">
          <p className="hx-kicker"><span className="pulse" aria-hidden="true" />Verified medical fundraising on PayPal</p>
          <h1 id="hx-h" className="reveal-lines">
            <span><span>Give to the hospital bill,</span></span>
            <span><span>not to a promise.</span></span>
          </h1>
          <p className="hx-lede">
            Your gift is held safely by PayPal and released only to a hospital bill that has been checked and confirmed. Forged bills get caught,
            and anything the bill doesn&apos;t need is never charged.
          </p>
          <div className="hx-cta">
            <DemoButton scenario="honest" label="Help a verified patient" className="btn warm lg" />
            <Link href="/lab" className="btn glass lg">Try to forge a bill</Link>
          </div>
          <ul className="hx-trust" aria-label="How your gift is protected">
            <li><b>Held</b> by PayPal, not charged</li>
            <li><b>Read</b> by Gemini, checked by rules</li>
            <li><b>$0</b> kept by Earmark</li>
          </ul>
        </div>
        <div className="hx-card-wrap">
          <HeroReceipt />
        </div>
      </div>
    </section>

    <div className="wrap">
      <section className="patients" aria-labelledby="pt-h">
        <div className="sec-head">
          <h2 id="pt-h">Families you can help today</h2>
          <p>Every campaign starts with the hospital&apos;s own documents, checked before anyone can give. <span className="muted">Demo patients are fictional.</span></p>
        </div>
        <div className="pt-grid">
          <article className="pt-card">
            <div className="pt-top">
              <span className="pt-avatar a1" aria-hidden="true">M</span>
              <span className="pt-badge">Verified · 10 of 10 checks</span>
            </div>
            <h3>Help Maya recover from emergency surgery</h3>
            <p className="pt-meta">Maya, 9 · Appendectomy · Riverside Children&apos;s Hospital, Austin</p>
            <div className="pt-bar" aria-hidden="true"><span style={{ width: "0%" }} /></div>
            <p className="pt-goal"><b>$2,400</b> verified goal · be the first to give</p>
            <DemoButton scenario="honest" label="Give to Maya" className="btn warm" />
          </article>
          <article className="pt-card">
            <div className="pt-top">
              <span className="pt-avatar a2" aria-hidden="true">A</span>
              <span className="pt-badge">Verified · hospital confirmed</span>
            </div>
            <h3>Help Aarav breathe and sleep again</h3>
            <p className="pt-meta">Aarav · Tonsil and adenoid surgery · Riverside Children&apos;s Hospital</p>
            <div className="pt-bar" aria-hidden="true"><span style={{ width: "67%" }} /></div>
            <p className="pt-goal"><b>$1,200</b> held of <b>$1,800</b> · 3 donors</p>
            <Link href="/campaigns" className="btn soft">See Aarav&apos;s campaign</Link>
          </article>
          <article className="pt-card pt-start">
            <span className="pt-avatar a3" aria-hidden="true">+</span>
            <h3>Raising money for someone&apos;s care?</h3>
            <p className="pt-meta">Upload the hospital&apos;s estimate. Earmark checks it in seconds, and donations go straight to the hospital, so nobody can question where they went.</p>
            <Link href="/start" className="btn soft">Start a campaign</Link>
          </article>
        </div>
      </section>
    </div>

    <section className="statement" aria-label="The promise">
      <div className="mesh" aria-hidden="true" />
      <div className="wrap">
        <p className="statement-big">Kindness shouldn&apos;t need trust.</p>
        <p className="statement-sub">On Earmark, a donation can only ever pay the hospital. Not the family, not a forger, not us.</p>
        <LabScore />
      </div>
    </section>

    <PledgeStory />

    <div className="wrap">
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

      <section className="band" aria-labelledby="layers">
        <div>
          <h2 id="layers">Why a scam can&apos;t cash out</h2>
          <p className="intro">Three independent layers. A forger has to beat all three, and the third can&apos;t be beaten.</p>
        </div>
        <ol className="layers">
          <li>
            <span className="layer-n">1</span>
            <div><strong>The documents are investigated</strong><p>An AI transcribes every page; deterministic rules check it: registry details, arithmetic to the cent, one patient everywhere, every document Earmark has ever seen (even cropped, re-saved copies), and hidden text aimed at the AI. Reviewers see a box over every forged value.</p></div>
          </li>
          <li>
            <span className="layer-n">2</span>
            <div><strong>The hospital is asked directly</strong><p>Earmark contacts the billing office through its own registry, never the phone number printed on the document, and asks: did you issue this estimate, for this patient, for this amount?</p></div>
          </li>
          <li>
            <span className="layer-n">3</span>
            <div><strong>The money only pays the verified hospital</strong><p>Pledges are PayPal authorizations. They&apos;re captured only for a bill the hospital submits, split fairly across donors, and Earmark&apos;s settlement pays only the hospital&apos;s registry-verified PayPal account. The family receives $0; so does a forger who got this far.</p></div>
          </li>
        </ol>
      </section>

      <section className="band" aria-labelledby="checks">
        <div>
          <h2 id="checks">What Earmark checks</h2>
          <p className="intro">An AI reads the documents. Plain rules decide, and every result shows its evidence.</p>
        </div>
        <div className="checklist">
          <div><b>The provider is verified</b><span>Hospital, clinic or pharmacy: name, phone and licence must match the registry.</span></div>
          <div><b>The totals add up</b><span>Line items must explain the printed total, to the cent.</span></div>
          <div><b>One patient, everywhere</b><span>Name and age agree across the estimate, registration card and bill.</span></div>
          <div><b>Nothing is reused</b><span>A file or document number seen in another campaign puts it on hold.</span></div>
          <div><b>No signs of editing</b><span>Numbers in a different font, pasted regions, overwritten totals.</span></div>
          <div><b>No hidden instructions</b><span>A document that tells the AI to approve it is treated as fraud.</span></div>
          <div><b>Confirmed by the hospital</b><span>The billing office confirms the document number, the patient and the amount.</span></div>
          <div><b>No re-saved copies</b><span>A visual fingerprint recognises a page even after cropping and re-saving.</span></div>
          <div><b>The bill matches the estimate</b><span>Growth beyond 15% of the verified estimate needs a human reviewer.</span></div>
          <div><b>Only medical care is paid</b><span>Each bill line is classified; non-medical extras are excluded.</span></div>
        </div>
      </section>

      <section className="band" aria-labelledby="fair">
        <div>
          <h2 id="fair">Fair to real families</h2>
          <p className="intro">Stopping fraud must never mean turning away a sick child.</p>
        </div>
        <div className="checklist">
          <div><b>Rules never reject anyone</b><span>A failed check puts the campaign on hold with the evidence. A person decides, and the family can explain.</span></div>
          <div><b>Medicines are covered too</b><span>Up to 10% of the goal for verified pharmacy or supply receipts, paid to the pharmacy.</span></div>
          <div><b>The family never handles money</b><span>Payments go to verified providers only, so nobody can question where it went.</span></div>
          <div><b>Built for urgent care</b><span>PayPal holds pledges for up to 29 days. Longer treatments settle bill by bill.</span></div>
        </div>
      </section>

      <section className="band" aria-labelledby="try">
        <div>
          <h2 id="try">Try it</h2>
          <p className="intro">Demo campaigns built from fictional hospital documents. Open them in order, then the <Link href="/radar">reuse radar</Link>.</p>
          <p className="intro">Your demo is private to your browser. Start again any time:</p>
          <div style={{ marginTop: 10 }}><ResetDemo /></div>
        </div>
        <div className="tryit three">
          <div className="card lab-card">
            <h3>Forge a bill yourself</h3>
            <p>Edit Maya&apos;s real estimate in your browser: change the total, the patient, the phone number, hide a note for the AI, or crop and re-save it. Then try to get paid.</p>
            <Link href="/lab" className="btn danger-solid">Open the Forgery Lab</Link>
          </div>
          <div className="card">
            <h3>Maya needs emergency surgery</h3>
            <p>A genuine estimate, registration card and doctor&apos;s note. Verified in seconds. Pledge, submit the hospital&apos;s bill and a pharmacy receipt, and watch the money split.</p>
            <DemoButton scenario="honest" label="Open Maya's campaign" />
          </div>
          <div className="card">
            <h3>An urgent appeal for Leo</h3>
            <p>An edited total, a borrowed document number, a mismatched patient and a hidden note telling the AI to approve it.</p>
            <DemoButton scenario="fraud" label="Open Leo's campaign" className="btn danger" />
          </div>
          <div className="card">
            <h3>A copy of Maya&apos;s campaign</h3>
            <p>A stranger uploads Maya&apos;s real documents to raise money for themselves. The most common scam, caught in one check.</p>
            <DemoButton scenario="copycat" label="Open the copycat" className="btn danger" />
          </div>
        </div>
      </section>
      <section className="band mark-band" aria-labelledby="mark">
        <div>
          <h2 id="mark">Why it&apos;s called Earmark</h2>
          <p className="intro">To earmark money is to set it aside for one purpose. The mark is built from three parts that say how.</p>
        </div>
        <div className="mark-parts">
          <div className="mark-hero"><Logo size={132} title="The Earmark mark" /></div>
          <dl>
            {[
              { part: "page", name: "The page", say: "A hospital bill: the only thing a donation can pay." },
              { part: "fold", name: "The folded corner", say: "Earmarked: the money is turned down for this bill and no other." },
              { part: "check", name: "The check", say: "Cut out of the page: verified before a cent moves." },
            ].map((p) => (
              <div key={p.part}>
                <dt>
                  <svg viewBox="0 0 48 48" aria-hidden="true" className={`part-${p.part}`}>
                    <path className="pg" d={MARK.page} /><path className="fd" d={MARK.fold} /><path className="ck" d={MARK.check} />
                  </svg>
                  {p.name}
                </dt>
                <dd>{p.say}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
    </>
  );
}
