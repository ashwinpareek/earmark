import Link from "next/link";
import HeroReceipt from "@/components/HeroReceipt";
import DemoButton from "@/components/DemoButtons";

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <h1>Donations that can only pay the bill.</h1>
          <p className="lede">
            Earmark checks the hospital&apos;s documents before a medical fundraiser goes live. Donations are held on PayPal, not charged. When the
            hospital&apos;s bill is verified, each donor pays a fair share, straight to the hospital, and the rest is never charged.
          </p>
          <div className="row">
            <Link href="/start" className="btn">Start a campaign</Link>
            <DemoButton scenario="honest" label="See a verified campaign" className="btn ghost" />
          </div>
          <p className="fine">
            Medical fundraisers raise hundreds of millions a year on trust alone. Fake campaigns use real children&apos;s photos, inflate targets after
            launch and keep the money. Earmark removes the trust step: the money can&apos;t go anywhere except the verified bill.
          </p>
        </div>
        <HeroReceipt />
      </section>

      <section className="band" aria-labelledby="how">
        <div>
          <h2 id="how">How a campaign works</h2>
          <p className="intro">The family never touches the money, and no donor pays for anything that isn&apos;t on a verified bill.</p>
        </div>
        <ol className="flow">
          <li><div><strong>The family uploads the hospital&apos;s estimate</strong><p>Plus the patient&apos;s registration card and a doctor&apos;s note. An AI reads every document, including photos taken on a phone.</p></div></li>
          <li><div><strong>Earmark checks the documents</strong><p>Is the hospital real and are its details right? Do the totals add up? Is it the same patient everywhere? Has this document been used in another campaign? Fake campaigns stop here.</p></div></li>
          <li><div><strong>Donors pledge, and PayPal holds the money</strong><p>Each donation is a PayPal authorization. Nothing is charged, and donors can see exactly where their money can go.</p></div></li>
          <li><div><strong>The hospital submits the final bill</strong><p>Earmark compares it with the estimate line by line. Parking passes and gift-shop charges aren&apos;t medical care, so donations don&apos;t pay for them.</p></div></li>
          <li><div><strong>Every donor pays the same fair share</strong><p>Earmark collects only what the verified bill needs, splits it evenly across pledges and pays the hospital directly. The rest of every pledge is released and never charged.</p></div></li>
        </ol>
      </section>

      <section className="band" aria-labelledby="checks">
        <div>
          <h2 id="checks">What Earmark checks</h2>
          <p className="intro">An AI reads the documents. Plain rules decide, and every result shows its evidence.</p>
        </div>
        <div className="checklist">
          <div><b>The hospital is verified</b><span>Name, phone and licence number must match the hospital registry.</span></div>
          <div><b>The totals add up</b><span>Line items must explain the printed total, to the cent.</span></div>
          <div><b>One patient, everywhere</b><span>Name and age agree across the estimate, registration card and bill.</span></div>
          <div><b>Nothing is reused</b><span>A file or document number seen in another campaign is rejected.</span></div>
          <div><b>No signs of editing</b><span>Numbers in a different font, pasted regions, overwritten totals.</span></div>
          <div><b>No hidden instructions</b><span>A document that tells the AI to approve it is treated as fraud.</span></div>
          <div><b>The bill matches the estimate</b><span>Growth beyond 15% of the verified estimate needs a human reviewer.</span></div>
          <div><b>Only medical care is paid</b><span>Each bill line is classified; non-medical extras are excluded.</span></div>
        </div>
      </section>

      <section className="band" aria-labelledby="try">
        <div>
          <h2 id="try">Try both sides</h2>
          <p className="intro">Two demo campaigns built from fictional hospital documents.</p>
        </div>
        <div className="tryit">
          <div className="card">
            <h3>Maya needs emergency surgery</h3>
            <p>A real estimate, registration card and doctor&apos;s note. Verified in seconds. Pledge, then submit the hospital&apos;s final bill and watch the money split.</p>
            <DemoButton scenario="honest" label="Open Maya's campaign" />
          </div>
          <div className="card">
            <h3>An urgent appeal for Leo</h3>
            <p>An estimate with an edited total, a borrowed document number, a mismatched patient and a hidden note to the AI. See what happens.</p>
            <DemoButton scenario="fraud" label="Open Leo's campaign" className="btn danger" />
          </div>
        </div>
      </section>
    </div>
  );
}
