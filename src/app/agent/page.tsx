import type { Metadata } from "next";
import GivingAgent from "@/components/GivingAgent";

export const metadata: Metadata = { title: "Your Giving Agent — Earmark" };
export const dynamic = "force-dynamic";

export default function AgentPage() {
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
        <GivingAgent />
      </div>
    </>
  );
}
