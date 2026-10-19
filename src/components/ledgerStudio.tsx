"use client";
import { useEffect, useRef, useState } from "react";
import { createAiHarness, directLlmRunner, type AgAiTool, type AgLlmAdapter, type AgStudioApi, type AgWidgetParams } from "ag-studio";
import { createWidgets } from "ag-studio-react";

// Earmark's own additions to AG Studio:
//  1. "Money trail" — a custom widget that follows pledged money to where it ended up and
//     states the guarantee in the last step: paid to families, $0.00. It respects page filters
//     and cross-filters like any built-in widget.
//  2. "Earmark auditor" — a custom agent that fronts the AI panel. It has two tools of its own
//     (open a campaign's case file, trace a donor's pledge through PayPal) plus Studio's query
//     tools, and hands dashboard changes to Studio's built-in lead agent. It can read; it cannot
//     change anything about a campaign or move money.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Money trail widget ─────────────────────────────────────────────────

type Stage = { label: string; value: number; text: string; family: boolean };

function MoneyTrail({ dataMapping, widgetApi }: AgWidgetParams<any>) {
  const [stages, setStages] = useState<Stage[]>([]);
  const loaded = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const fields = ((dataMapping as any)?.stages ?? []) as any[];
      if (!fields.length) { widgetApi.setDisplayState("incompleteDataMapping"); return; }
      widgetApi.setDisplayState("loading", { prominent: !loaded.current });
      const res = await widgetApi.getData({ fields });
      const row = res.results.rows[0] ?? {};
      const out = fields.map((f) => {
        const v = Number(row[f.key] ?? 0);
        return { label: f.name, value: v, text: widgetApi.formatFieldValue(f, v), family: /famil/i.test(f.name) };
      });
      if (!alive) return;
      loaded.current = true;
      setStages(out);
      widgetApi.setDisplayState(out.some((s) => s.value) || out.some((s) => s.family) ? "displayed" : "noData");
    })().catch(() => widgetApi.setDisplayState("noData"));
    return () => { alive = false; };
  }, [dataMapping, widgetApi]);

  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="mt">
      <div className="mt-title">Money trail <span>Follow every pledged dollar</span></div>
      <ol className="mt-stages">
        {stages.map((s, i) => (
          <li key={s.label + i} className={s.family ? "fam" : ""}>
            <div className="mt-lbl">{s.label}</div>
            <div className="mt-bar"><span style={{ width: s.family ? "0%" : `${Math.max(2, (s.value / max) * 100)}%` }} /></div>
            <div className="mt-val">{s.text}{s.family && s.value === 0 && <b className="mt-ok">Guarantee held</b>}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const studioWidgets = () =>
  createWidgets({
    additionalTypes: [
      {
        id: "money-trail",
        label: "Money trail",
        icon: { url: "/favicon.svg" },
        dataMapping: {
          stages: { type: "fieldset", supportedRoles: ["numeric"], requires: { cardinality: "one" }, required: true, aiDescription: "Money amounts in the order the money flows, e.g. pledged, charged, never charged, paid to families." },
        },
        form: (params: any) => params.createDefaults({ dataMappingItems: [{ key: "stages", label: "Stages, in order" }] }),
        comp: MoneyTrail,
        defaultSize: { width: 600, height: 260 },
        minSize: { width: 320, height: 180 },
        ai: { description: "Earmark's money trail: shows how pledged money flowed, ending with the amount paid to families (always $0)." },
      } as any,
    ],
    menu: [{ label: "Earmark", widgetIds: ["money-trail"] } as any],
  } as any) as any;

// ─── Earmark auditor agent ────────────────────────────────────────────────

export type LedgerRows = { campaigns: Record<string, unknown>[]; donations: Record<string, unknown>[]; movements: Record<string, unknown>[] };

const AUDITOR = `You are the Earmark auditor, answering questions about Earmark's public transparency ledger.
Earmark is medical fundraising on PayPal: every pledge is a PayPal authorization (a hold, not a charge). When the hospital's final bill is verified, each hold is partially captured for a fair share, the rest is released ("never charged"), and the money is paid out only to verified hospitals and pharmacies — never to families. Campaigns whose documents fail checks are held for a human reviewer.
Rules for you:
- Every number or fact you state must come from a tool result in this conversation. Say where it came from (a case file, a pledge trace, or a query on a named table).
- Use open_case_file to explain why a campaign is live or on hold; use trace_pledge to follow a donor's money through PayPal.
- To change the dashboard (add a chart, filter, page), delegate to the lead agent.
- You cannot change campaigns, approve anything or move money, and you must never say you can.
- Be brief and plain: two to five sentences, or a short list.`;

function pick(rows: Record<string, unknown>[], q: string, keys: string[]) {
  const s = q.trim().toLowerCase();
  return rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase() === s)).concat(rows.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(s))));
}

export function makeHarness(api: AgStudioApi, adapter: AgLlmAdapter, rows: () => LedgerData, prompts: { label: string; prompt: string }[]) {
  const openCaseFile: AgAiTool = api.defineAiTool({
    name: "open_case_file",
    description: "Open a campaign's case file: its verification verdict, every failed or flagged check with its evidence, the AI investigator's notes, and where its money went. Look a campaign up by title, patient (e.g. 'Maya R.') or campaign ID.",
    params: (s: any) => s.object({ campaign: s.string({ description: "Campaign title, patient display name or campaign ID" }) }),
    execute: async (args: any, ctx: any) => {
      const hit = pick(rows().campaigns, String(args.campaign ?? ""), ["id", "title", "patient"])[0];
      if (!hit) return ctx.error(`No campaign matches "${args.campaign}". Campaigns: ${rows().campaigns.map((c) => c.title).join("; ")}`);
      const r = await fetch(`/api/campaigns/${hit.id}?role=donor`, { cache: "no-store", signal: ctx.signal });
      if (!r.ok) return ctx.error("Couldn't load that case file.");
      const c = await r.json();
      const v = c.verification ?? {};
      const out = {
        title: c.title, patient: c.patient?.displayName, hospital: c.provider?.name, status: c.status, verdict: v.decision, risk: v.risk,
        problems: (v.checks ?? []).filter((k: any) => k.status !== "pass").map((k: any) => ({ check: k.label, result: k.status, evidence: k.detail })),
        checksPassed: (v.checks ?? []).filter((k: any) => k.status === "pass").length,
        investigatorNotes: v.notes?.text,
        verifiedGoal: c.goal, settlement: c.settlement ?? null,
      };
      return ctx.success(JSON.stringify(out), out);
    },
  } as any);

  const tracePledge: AgAiTool = api.defineAiTool({
    name: "trace_pledge",
    description: "Trace a donor's pledge through PayPal: the hold (authorization), the fair-share capture, the released remainder and the payout to the provider, with PayPal IDs and whether PayPal confirmed each step.",
    params: (s: any) => s.object({ donor: s.string({ description: "Donor name as shown in the ledger" }) }),
    execute: async (args: any, ctx: any) => {
      const d = rows();
      const matches = pick(d.donations, String(args.donor ?? ""), ["donor"]).slice(0, 3);
      if (!matches.length) return ctx.error(`No pledge from "${args.donor}". Donors: ${[...new Set(d.donations.map((x) => x.donor))].slice(0, 20).join(", ")}`);
      const out = matches.map((p) => ({
        donor: p.donor, campaign: d.campaigns.find((c) => c.id === p.campaignId)?.title, status: p.status, pledged: p.pledged, charged: p.charged, neverCharged: p.neverCharged,
        paypal: d.movements.filter((m) => m.donationId === p.id || (m.type === "payout" && m.campaignId === p.campaignId)).map((m) => ({ step: m.type, amount: m.amount, paypalId: m.paypalId, status: m.status, confirmedBy: m.confirmed, note: m.note })),
      }));
      return ctx.success(JSON.stringify(out), out);
    },
  } as any);

  return createAiHarness(api, ({ tools, builtIn }: any) => ({
    agents: [
      directLlmRunner({
        id: "auditor",
        name: "Earmark auditor",
        description: "Answers questions about campaigns, checks and where the money went, from the ledger.",
        adapter,
        schema: (s: any) => s.undefined(),
        instructions: () => AUDITOR,
        tools: () => [openCaseFile, tracePledge, tools.studio.viewSchema(), tools.studio.executeQuery(), tools.delegateTo(["lead"])],
        maxTurns: 10,
      } as any),
      ...Object.values(builtIn).map((definition: any) => directLlmRunner({ ...definition, adapter })),
    ],
    primary: "auditor",
    promptStarters: prompts,
  })) as any;
}

type LedgerData = LedgerRows;

// How our tools appear as steps in the AI panel.
export const toolDisplay = {
  open_case_file: { label: ({ args, status }: any) => ({ text: status === "running" ? "Opening the case file" : "Opened the case file", pill: String(args?.campaign ?? "") || undefined }) },
  trace_pledge: { label: ({ args, status }: any) => ({ text: status === "running" ? "Tracing the pledge through PayPal" : "Traced the pledge through PayPal", pill: String(args?.donor ?? "") || undefined }) },
} as any;
