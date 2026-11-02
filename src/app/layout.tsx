import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/fraunces/full.css";
import "./globals.css";
import Logo from "@/components/Logo";
import Splash from "@/components/Splash";
import MobileDock from "@/components/MobileDock";
import SmoothScroll from "@/components/SmoothScroll";
import { paypalMode } from "@/lib/paypal";
import { aiProvider, aiModelName } from "@/lib/ai";

export const metadata: Metadata = {
  title: "Earmark — the best a scammer can do is pay a stranger's hospital bill",
  description: "Medical fundraising on PayPal where donations are holds that can only pay a hospital-confirmed bill. Forge a bill in the Forgery Lab and watch Earmark catch it.",
  icons: { icon: "/favicon.svg" },
};

export const dynamic = "force-dynamic";

const SPLASH_GATE = `try{var d=document.documentElement;if(sessionStorage.getItem("em-splash")||matchMedia("(prefers-reduced-motion: reduce)").matches||navigator.webdriver&&!location.search.includes("splash")){d.dataset.splash="skip"}else{sessionStorage.setItem("em-splash","1")}}catch(e){document.documentElement.dataset.splash="skip"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <html lang="en" data-splash="on" suppressHydrationWarning>
      <head>
        {/* Decide before first paint whether the opening sequence plays: once per visit, never with reduced motion. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE }} />
      </head>
      <body>
        <Splash />
        {(pp === "mock" || ai === "offline") && (
          <div className="banner">
            <div className="wrap">
              {pp === "mock" && <>PayPal is in local mock mode. Add sandbox keys to <code>.env</code> to move sandbox money. </>}
              {ai === "offline" && <>No AI key is set, so only the sample documents can be read.</>}
            </div>
          </div>
        )}
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand" aria-label="Earmark home"><Logo /> Earmark</Link>
            <nav className="nav" aria-label="Main">
              <span className="runtime" title="What this deployment is running on">
                <span className="chip pp"><span className={`dot ${pp === "mock" ? "warn" : ""}`} /> PayPal {pp}</span>
                <span className="chip"><span className={`dot ${ai === "offline" ? "warn" : ""}`} /> {ai === "offline" ? "AI offline" : aiModelName()}</span>
              </span>
              <Link href="/agent" className="nav-agent">Giving Agent</Link>
              <Link href="/lab" className="nav-lab">Forgery Lab</Link>
              <Link href="/campaigns" className="hide-sm">Campaigns</Link>
              <Link href="/review" className="hide-sm">Review</Link>
              <Link href="/ledger" className="hide-sm">Ledger</Link>
              <Link href="/start" className="btn sm">Start a campaign</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap foot-grid">
            <div className="foot-brand"><Logo size={34} /><div><b>Earmark</b><span>Donations that can only pay the hospital.</span></div></div>
            <nav aria-label="Footer">
              <Link href="/lab">Forgery Lab</Link>
              <Link href="/campaigns">Campaigns</Link>
              <Link href="/ledger">Public ledger</Link>
              <Link href="/radar">Reuse radar</Link>
            </nav>
            <p>Built on PayPal (Orders v2, Payouts, Agent Toolkit) and Gemini. Runs on the PayPal sandbox; every hospital, patient and document in the demo is fictional. MIT licensed.</p>
          </div>
        </footer>
        <MobileDock />
        <SmoothScroll />
      </body>
    </html>
  );
}
