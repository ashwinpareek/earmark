import type { Metadata } from "next";
import GivingAgent from "@/components/GivingAgent";
import { demoSpace } from "@/lib/space";
import { mandateForSpace } from "@/lib/store";
import { catalog } from "@/lib/catalog";
import { publicMandate } from "@/lib/agent-tools";
import { paypalMode } from "@/lib/paypal";

export const metadata: Metadata = { title: "Your Giving Agent — Earmark" };
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const space = await demoSpace();
  const [m, cat] = await Promise.all([space ? mandateForSpace(space) : undefined, catalog().catch(() => [])]);
  const initial = {
    mandate: m ? publicMandate(m) : null,
    catalog: cat,
    pp: { mode: paypalMode() === "sandbox" ? ("sandbox" as const) : ("mock" as const), clientId: paypalMode() === "sandbox" ? process.env.PAYPAL_CLIENT_ID ?? null : null },
  };
  return (
    <>
      <section className="hx hx-sm" aria-labelledby="ga-h">
        <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="wrap">
          <p className="hx-kicker"><span className="pulse" aria-hidden="true" />Agentic giving · PayPal + Gemini</p>
          <h1 id="ga-h">An agent that can promise money, but never spend it.</h1>
          <p className="hx-lede">
            Tell it what you care about and set your limits once. It finds verified patients, reads the hospital&apos;s evidence and gives for you,
            as PayPal holds that can only ever pay a bill the hospital confirms. Even a fooled agent can&apos;t send a cent anywhere else.
          </p>
        </div>
      </section>
      <div className="wrap">
        <GivingAgent initial={initial} />
      </div>
    </>
  );
}
