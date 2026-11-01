import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import Logo from "@/components/Logo";
import { paypalMode } from "@/lib/paypal";
import { aiProvider, aiModelName } from "@/lib/ai";

export const metadata: Metadata = {
  title: "Earmark — the best a scammer can do is pay a stranger's hospital bill",
  description: "Medical fundraising on PayPal where donations are holds that can only pay a hospital-confirmed bill. Forge a bill in the Forgery Lab and watch Earmark catch it.",
  icons: { icon: "/favicon.svg" },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <html lang="en">
      <head>
      </head>
      <body>
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
              <Link href="/lab" className="nav-lab">Forgery Lab</Link>
              <Link href="/campaigns" className="hide-sm">Campaigns</Link>
              <Link href="/radar" className="hide-sm">Radar</Link>
              <Link href="/hospital" className="hide-sm">Providers</Link>
              <Link href="/review" className="hide-sm">Review</Link>
              <Link href="/ledger" className="hide-sm">Ledger</Link>
              <Link href="/start" className="btn sm">Start a campaign</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <div className="wrap">Earmark runs on the PayPal sandbox. Every hospital, patient and document in the demo is fictional. MIT licensed.</div>
        </footer>
      </body>
    </html>
  );
}
