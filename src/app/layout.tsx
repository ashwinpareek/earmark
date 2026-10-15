import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Logo from "@/components/Logo";
import { paypalMode } from "@/lib/paypal";
import { aiProvider, aiModelName } from "@/lib/ai";

export const metadata: Metadata = {
  title: "Earmark — donations that can only pay the bill",
  description: "Verified medical fundraising on PayPal. Donations are held, not charged, until the hospital's bill is verified — then paid straight to the hospital.",
  icons: { icon: "/favicon.svg" },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pp = paypalMode();
  const ai = aiProvider();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" />
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
              <span className="runtime" title="Runtime configuration">
                <span className={`dot ${pp === "mock" ? "warn" : ""}`} /> PayPal {pp}
                <span className={`dot ${ai === "offline" ? "warn" : ""}`} /> {aiModelName()}
              </span>
              <Link href="/campaigns" className="hide-sm">Campaigns</Link>
              <Link href="/hospital" className="hide-sm">Hospitals</Link>
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
