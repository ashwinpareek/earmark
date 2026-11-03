import Link from "next/link";
import HeroBeam from "@/components/HeroBeam";
import DemoButton from "@/components/DemoButtons";
import ResetDemo from "@/components/ResetDemo";
import LabScore from "@/components/LabScore";
import PledgeStory from "@/components/PledgeStory";
import FairStory from "@/components/FairStory";
import TryVisual from "@/components/TryVisual";
import AgentReel from "@/components/AgentReel";
import DocTunnel from "@/components/DocTunnel";
import ScanScene from "@/components/ScanScene";
import { catalog } from "@/lib/catalog";
import { showcase } from "@/lib/showcase";
import JudgeGuide from "@/components/JudgeGuide";
import { paypalMode } from "@/lib/paypal";
import Logo, { MARK } from "@/components/Logo";

const money = (v: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));

export const dynamic = "force-dynamic";

export default async function Home() {
  const [families, show] = await Promise.all([catalog().catch(() => []), showcase().catch(() => ({ beam: undefined, tunnel: undefined }))]);
  const login = paypalMode() === "sandbox" && process.env.JUDGE_BUYER_EMAIL && process.env.JUDGE_BUYER_PASSWORD ? { email: process.env.JUDGE_BUYER_EMAIL, password: process.env.JUDGE_BUYER_PASSWORD } : null;
  return (
    <>
    <JudgeGuide login={login} />
    <section className="hx hx-center" aria-labelledby="hx-h">
      <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="wrap hx-copy">
        <p className="hx-kicker"><span className="pulse" aria-hidden="true" />Verified medical fundraising on PayPal</p>
        <h1 id="hx-h" className="reveal-lines">
          <span><span>Give to the hospital bill,</span></span>
          <span><span>not to a promise.</span></span>
        </h1>
        <p className="hx-lede">
          Gemini reads every hospital document. Plain rules check every claim. PayPal holds every gift and pays only the bill the hospital
          confirms. Forgeries go nowhere; what the bill doesn&apos;t need is never charged.
        </p>
        <div className="hx-cta">
          <a href="#families" className="btn warm lg">Help a verified patient</a>
          <Link href="/agent" className="btn glass lg">Meet your Giving Agent</Link>
        </div>
        <p className="hx-alt">Or <Link href="/lab">try to forge a bill</Link> and watch Earmark catch it.</p>
      </div>
      <HeroBeam rows={show.beam} />
    </section>

    <div className="wrap">
      <section className="patients" id="families" aria-labelledby="pt-h">
        <div className="sec-head">
          <h2 id="pt-h">Families you can help today</h2>
          <p>Every campaign starts with the hospital&apos;s own documents, checked before anyone can give. Gifts are PayPal holds, paid only to the hospital. <span className="muted">Patients and hospitals are fictional; PayPal runs on its sandbox.</span></p>
        </div>
        <div className="pt-grid">
          {families.map((c, i) => {
            const pct = Math.min(100, (Number(c.held) / Number(c.goal)) * 100);
            return (
              <article className="pt-card" key={c.id}>
                <div className="pt-top">
                  <span className={`pt-avatar a${(i % 3) + 1}`} aria-hidden="true">{c.patient[0]}</span>
                  <span className="pt-badge">{c.checksFailed === 0 ? `Verified · ${c.checksTotal} checks, none failed` : "Under review"}</span>
                </div>
                <h3>{c.title}</h3>
                <p className="pt-meta">{c.patient.replace(/\.$/, "")}{c.age !== null ? `, ${c.age}` : ""} · {c.procedure} · {c.hospital}, {c.city}</p>
                <div className="pt-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                <p className="pt-goal">{Number(c.held) > 0 ? <><b>{money(c.held)}</b> held of <b>{money(c.goal)}</b> · {c.donors} {c.donors === 1 ? "donor" : "donors"}</> : <><b>{money(c.goal)}</b> verified goal · be the first to give</>}</p>
                <Link href={`/c/${c.id}?role=donor`} className="btn warm">Give to {c.patient.split(" ")[0]}</Link>
              </article>
            );
          })}
          {families.length === 0 && (
            <article className="pt-card pt-start">
              <h3>Verifying today&apos;s families…</h3>
              <p className="pt-meta">Earmark is reading their hospital documents. Refresh in a minute, or try the full journey with Maya.</p>
              <DemoButton scenario="honest" label="Follow Maya's campaign" className="btn soft" />
            </article>
          )}
        </div>
        <div className="pt-more">
          <span>Want the whole journey, from pledge to paid hospital bill, in two minutes?</span>
          <DemoButton scenario="honest" label="Run Maya's demo campaign" className="btn soft" />
          <Link href="/start" className="btn ghost">Start a campaign</Link>
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
            <TryVisual kind="forge" />
            <h3>Forge a bill yourself</h3>
            <p>Edit Maya&apos;s real estimate in your browser: change the total, the patient, the phone number, hide a note for the AI, or crop and re-save it. Then try to get paid.</p>
            <Link href="/lab" className="btn danger-solid">Open the Forgery Lab</Link>
          </div>
          <div className="card">
            <TryVisual kind="maya" />
            <h3>Maya needs emergency surgery</h3>
            <p>A genuine estimate, registration card and doctor&apos;s note. Verified in seconds. Pledge, submit the hospital&apos;s bill and a pharmacy receipt, and watch the money split.</p>
            <DemoButton scenario="honest" label="Open Maya's campaign" />
          </div>
          <div className="card">
            <TryVisual kind="leo" />
            <h3>An urgent appeal for Leo</h3>
            <p>An edited total, a borrowed document number, a mismatched patient and a hidden note telling the AI to approve it.</p>
            <DemoButton scenario="fraud" label="Open Leo's campaign" className="btn danger" />
          </div>
          <div className="card">
            <TryVisual kind="copy" />
            <h3>A copy of Maya&apos;s campaign</h3>
            <p>A stranger uploads Maya&apos;s real documents to raise money for themselves. The most common scam, caught in one check.</p>
            <DemoButton scenario="copycat" label="Open the copycat" className="btn danger" />
          </div>
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

    <DocTunnel money={show.tunnel} />

    <PledgeStory />

    <section className="agent-band" aria-labelledby="ab-h">
      <div className="wrap ab-grid">
        <div>
          <p className="ab-kicker">New · Agentic giving</p>
          <h2 id="ab-h">Let an agent give for you. It can promise money, never spend it.</h2>
          <p className="ab-lede">Set a cause and two limits, and approve once in PayPal. Your Giving Agent, built on Gemini, finds verified patients, reads the hospital&apos;s evidence and places PayPal holds for you. Your limits are enforced by code, not by asking the AI, and every hold can only ever pay a bill the hospital confirms.</p>
          <div className="hx-cta"><Link href="/agent" className="btn warm lg">Meet your Giving Agent</Link></div>
          <p className="ab-mcp">Use Claude or ChatGPT? Add <code>/api/mcp</code> as a connector and give from inside the chat.</p>
        </div>
        <AgentReel />
      </div>
    </section>

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


      <section className="band wide" aria-labelledby="checks">
        <div>
          <h2 id="checks">What Earmark checks</h2>
          <p className="intro">Gemini reads the page. Plain rules decide, and every result points at its evidence. Watch the same scan catch a forged copy.</p>
        </div>
        <ScanScene />
      </section>

    </div>

    <FairStory />

    <div className="wrap">

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
