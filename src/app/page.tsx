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
    <div className="wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">Medical fundraising on PayPal</p>
          <h1>
            The best a scammer can do is pay a stranger&apos;s
            {" "}<span className="glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg></span>{" "}
            hospital bill.
          </h1>
          <p className="lede">
            Every donation is a PayPal hold, not a charge. It can only be collected for a bill the hospital itself confirms, and only paid to the
            hospital. Forge the paperwork and you get caught.
          </p>
          <div className="row">
            <Link href="/lab" className="btn danger-solid lg">Try to forge a bill</Link>
            <DemoButton scenario="honest" label="See a real campaign" className="btn ghost lg" />
          </div>
          <LabScore />
        </div>
        <HeroReceipt />
      </section>
    </div>

    <section className="statement grain" aria-label="The promise">
      <div className="wrap">
        <p className="statement-big">On Earmark, a donation can only ever pay the hospital.</p>
        <p className="statement-sub">Not the family. Not a forger. Not us.</p>
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
