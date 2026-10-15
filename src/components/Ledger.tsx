"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { studioTheme, type AgDataSourcesDefinition, type AgFieldDefinition, type AgFormat, type AgPageState, type AgReportState, type AgWidgetLayoutState } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";

// Earmark's public transparency ledger, built on AG Studio. Anyone can see, for every
// campaign: what was pledged, what the verified bill needed, what each donor paid, what was
// never charged, what reached the hospital — and every check that passed or failed.

type LedgerData = {
  asOf: string;
  campaigns: Record<string, unknown>[];
  donations: Record<string, unknown>[];
  movements: Record<string, unknown>[];
  checks: Record<string, unknown>[];
  billLines: Record<string, unknown>[];
};

type Spec = [id: string, name: string, format: AgFormat, hide?: boolean];
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fields = (s: Spec[]): AgFieldDefinition[] =>
  s.map(([id, name, format, hide]) => ({ id, name, format, ...(format === "currencyFormat" && { formatOptions: { format: USD } }), ...(hide && { hide }) }) as AgFieldDefinition);
const manyToOne = (id: string, src: string, tgt: string) => {
  const [st, sf] = src.split("."), [tt, tf] = tgt.split(".");
  return { id, source: { tableId: st, fieldId: sf }, target: { tableId: tt, fieldId: tf }, type: "many-to-one" as const };
};
const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const countd = (id: string) => ({ id, aggregation: "countd" as const });
const kpi = (text: string, value: { id: string; aggregation?: "sum" | "countd" }) => ({
  type: "value" as const,
  dataMapping: { value: [value] },
  format: { title: { enabled: true, text }, style: { typography: { fontFamily: "Hanken Grotesk, sans-serif", fontSize: 26, fontWeight: "bold" as const, fontStyle: "normal" as const } } },
});

function buildData(d: LedgerData): AgDataSourcesDefinition {
  // Outcome rows make "where did every pledged dollar end up?" a single donut.
  const outcomes = d.campaigns.flatMap((c) => {
    const held = Math.max(0, Number(c.pledged) - Number(c.charged) - Number(c.neverCharged));
    return [
      { id: `${c.id}-paid`, campaignId: c.id, outcome: "Paid to hospital", amount: Number(c.charged) },
      { id: `${c.id}-never`, campaignId: c.id, outcome: "Never charged", amount: Number(c.neverCharged) },
      { id: `${c.id}-held`, campaignId: c.id, outcome: "Held, awaiting bill", amount: c.status === "settled" ? 0 : held },
    ].filter((r) => r.amount > 0);
  });
  const dates = d.movements.map((m) => String(m.date)).sort();
  const today = d.asOf.slice(0, 10);
  return {
    description:
      "Earmark is a medical fundraising platform. Donations are PayPal authorizations (holds). When a hospital's final bill is verified, each donor's hold is partially captured for their fair share and the rest is voided (never charged); the captured total is paid out directly to the hospital. Campaigns are verified by document checks before going live.",
    sources: [
      {
        id: "campaigns",
        description: "One row per fundraising campaign.",
        data: d.campaigns,
        fields: fields([
          ["id", "Campaign ID", "textFormat", true], ["title", "Campaign", "textFormat"], ["patient", "Patient", "textFormat"], ["hospital", "Hospital", "textFormat"],
          ["status", "Status", "textFormat"], ["decision", "Verification", "textFormat"], ["goal", "Verified goal", "currencyFormat"], ["pledged", "Pledged", "currencyFormat"],
          ["charged", "Charged to donors", "currencyFormat"], ["neverCharged", "Never charged", "currencyFormat"], ["paidToHospital", "Paid to hospital", "currencyFormat"],
          ["checksFailed", "Checks failed", "integerFormat"], ["paidToFamily", "Paid to family", "currencyFormat"], ["blocked", "Blocked (claimed by rejected campaigns)", "currencyFormat"], ["createdAt", "Started", "dateFormat"],
        ]),
      },
      {
        id: "donations",
        description: "One row per pledge. Pledged = held amount; charged = captured share; never charged = released remainder.",
        data: d.donations,
        fields: fields([
          ["id", "Donation ID", "textFormat", true], ["campaignId", "Campaign ID", "textFormat", true], ["donor", "Donor", "textFormat"], ["status", "Pledge status", "textFormat"],
          ["pledged", "Pledged", "currencyFormat"], ["charged", "Charged", "currencyFormat"], ["neverCharged", "Never charged", "currencyFormat"], ["date", "Pledged on", "dateFormat"],
        ]),
      },
      {
        id: "movements",
        description: "Every PayPal money movement: hold (authorization), capture, void (released), payout (to hospital).",
        data: d.movements,
        fields: fields([
          ["id", "Movement ID", "textFormat", true], ["campaignId", "Campaign ID", "textFormat", true], ["type", "Movement", "textFormat"], ["amount", "Amount", "currencyFormat"],
          ["status", "PayPal status", "textFormat"], ["paypalId", "PayPal ID", "textFormat"], ["note", "Why", "textFormat"], ["date", "Date", "dateFormat"],
        ]),
      },
      {
        id: "outcomes",
        name: "Pledge outcomes",
        description: "Where pledged money ended up, per campaign.",
        data: outcomes,
        fields: fields([["id", "Outcome ID", "textFormat", true], ["campaignId", "Campaign ID", "textFormat", true], ["outcome", "Outcome", "textFormat"], ["amount", "Amount", "currencyFormat"]]),
      },
      {
        id: "checks",
        description: "Every verification check run on campaign documents and final bills.",
        data: d.checks,
        fields: fields([["id", "Check ID", "textFormat", true], ["campaignId", "Campaign ID", "textFormat", true], ["stage", "Stage", "textFormat"], ["check", "Check", "textFormat"], ["status", "Result", "textFormat"], ["source", "Decided by", "textFormat"]]),
      },
      {
        id: "billLines",
        name: "Bill lines",
        description: "Final bill lines with the estimate amount and whether donations may pay them.",
        data: d.billLines,
        fields: fields([["id", "Line ID", "textFormat", true], ["campaignId", "Campaign ID", "textFormat", true], ["line", "Charge", "textFormat"], ["estimate", "Estimate", "currencyFormat"], ["amount", "Billed", "currencyFormat"], ["covered", "Paid by donations", "textFormat"], ["reason", "Reason", "textFormat"]]),
      },
    ],
    relationships: [
      manyToOne("donation-campaign", "donations.campaignId", "campaigns.id"),
      manyToOne("movement-campaign", "movements.campaignId", "campaigns.id"),
      manyToOne("outcome-campaign", "outcomes.campaignId", "campaigns.id"),
      manyToOne("check-campaign", "checks.campaignId", "campaigns.id"),
      manyToOne("line-campaign", "billLines.campaignId", "campaigns.id"),
      { id: "movements-date-calendar", source: { tableId: "movements", fieldId: "date" }, target: { calendarId: "calendar" } },
    ],
    calendars: [{ id: "calendar", label: "Calendar", range: { from: { type: "date", value: dates[0] ?? today }, to: { type: "date", value: dates.at(-1) ?? today } }, fragments: ["year", "month", "week", "day"] }],
  };
}

const money: AgPageState = {
  id: "money",
  widgets: {
    "kpi-pledged": kpi("Pledged", sum("campaigns.pledged")),
    "kpi-paid": kpi("Paid to hospitals", sum("campaigns.paidToHospital")),
    "kpi-never": kpi("Never charged", sum("campaigns.neverCharged")),
    "kpi-family": kpi("Paid to families", sum("campaigns.paidToFamily")),
    outcomes: { type: "donut-chart", dataMapping: { categoryKey: [{ id: "outcomes.outcome" }], valueKey: [sum("outcomes.amount")] }, format: title("Where pledges ended up") },
    "by-campaign": {
      type: "column-chart-stacked",
      dataMapping: { categoryKey: [{ id: "campaigns.patient" }], valueKey: [sum("campaigns.charged"), sum("campaigns.neverCharged")] },
      format: { ...title("Charged vs never charged, by campaign"), style: { theme: { common: { legend: { enabled: true } } } } },
    },
    ledger: {
      type: "grid",
      dataMapping: { cols: [{ id: "movements.date" }, { id: "campaigns.patient" }, { id: "movements.type" }, sum("movements.amount"), { id: "movements.status" }, { id: "movements.paypalId" }, { id: "movements.note" }] },
      sort: [{ field: { id: "movements.date" }, direction: "desc" }],
      format: title("PayPal money movements"),
    },
  },
  widgetLayout: { "kpi-pledged": at(0, 0, 6, 7), "kpi-paid": at(6, 0, 6, 7), "kpi-never": at(12, 0, 6, 7), "kpi-family": at(18, 0, 6, 7), outcomes: at(0, 7, 9, 20), "by-campaign": at(9, 7, 15, 20), ledger: at(0, 27, 24, 28) },
};

const integrity: AgPageState = {
  id: "integrity",
  widgets: {
    "kpi-campaigns": kpi("Campaigns checked", countd("campaigns.id")),
    "kpi-checks": kpi("Checks run", countd("checks.id")),
    "kpi-failed": kpi("Checks failed", sum("campaigns.checksFailed")),
    "kpi-blocked": kpi("Fraudulent asks blocked", sum("campaigns.blocked")),
    "check-pivot": {
      type: "pivot-grid",
      dataMapping: { rows: [{ id: "checks.check" }], columns: [{ id: "checks.status" }], values: [countd("checks.id")] },
      format: { ...title("Check results"), style: { totalColumns: true } },
    },
    campaigns: {
      type: "grid",
      dataMapping: { cols: [{ id: "campaigns.title" }, { id: "campaigns.hospital" }, { id: "campaigns.decision" }, { id: "campaigns.status" }, sum("campaigns.checksFailed"), sum("campaigns.goal"), sum("campaigns.pledged")] },
      format: title("Campaigns and their verification"),
    },
    lines: {
      type: "grid",
      dataMapping: { cols: [{ id: "campaigns.patient" }, { id: "billLines.line" }, sum("billLines.estimate"), sum("billLines.amount"), { id: "billLines.covered" }, { id: "billLines.reason" }] },
      format: title("Final bill lines: what donations paid for"),
    },
  },
  widgetLayout: { "kpi-campaigns": at(0, 0, 6, 7), "kpi-checks": at(6, 0, 6, 7), "kpi-failed": at(12, 0, 6, 7), "kpi-blocked": at(18, 0, 6, 7), "check-pivot": at(0, 7, 10, 24), campaigns: at(10, 7, 14, 24), lines: at(0, 31, 24, 22) },
};

const theme = studioTheme.withParams({
  fontFamily: "Hanken Grotesk, sans-serif",
  fontSize: 14,
  textColor: "var(--ink)",
  foregroundColor: "var(--ink)",
  subtleTextColor: "var(--muted)",
  backgroundColor: "var(--surface)",
  borderColor: "var(--rule)",
  accentColor: "var(--held)",
  studioWrapperBorder: false,
  studioCanvasBackgroundColor: "var(--paper)",
  studioWrapperBackgroundColor: "var(--paper)",
  studioWidgetBackgroundColor: "var(--surface)",
  studioWidgetBorderRadius: 10,
  chartPaletteFills1Color: "#0f766e",
  chartPaletteStrokes1Color: "#0f766e",
  chartPaletteFills2Color: "#e7a92a",
  chartPaletteStrokes2Color: "#e7a92a",
  chartPaletteFills3Color: "#4338ca",
  chartPaletteStrokes3Color: "#4338ca",
});

const noSub = () => () => {};

export default function Ledger({ licenseKey }: { licenseKey?: string }) {
  const inBrowser = useSyncExternalStore(noSub, () => true, () => false);
  const [data, setData] = useState<LedgerData | null>(null);
  const [page, setPage] = useState<"money" | "integrity">("money");
  useEffect(() => { fetch("/api/ledger", { cache: "no-store" }).then((r) => r.json()).then(setData); }, []);
  const studioData = useMemo(() => (data ? buildData(data) : null), [data]);
  const initialState: AgReportState = useMemo(() => ({ selectedPageId: page, pages: [money, integrity] }), [page]);

  return (
    <div className="wrap" style={{ maxWidth: 1360 }}>
      <div className="page-head">
        <div>
          <h1>Transparency ledger</h1>
          <p className="muted" style={{ marginTop: 6 }}>Every pledge, every check and every PayPal movement, public. Built with AG Studio.</p>
        </div>
        <div className="seg" role="group" aria-label="Report page">
          <button aria-pressed={page === "money"} onClick={() => setPage("money")}>Money</button>
          <button aria-pressed={page === "integrity"} onClick={() => setPage("integrity")}>Integrity</button>
        </div>
      </div>
      {!data || !inBrowser ? (
        <span className="thinking"><span className="spinner" /> Loading the ledger</span>
      ) : data.campaigns.length === 0 ? (
        <div className="card"><p><strong>No campaigns yet.</strong> <Link href="/">Open a demo campaign</Link> and it will appear here.</p></div>
      ) : (
        <div className="studio-box">
          <AgStudioProvider licenseKey={licenseKey}>
            <AgStudio key={page} style={{ height: "100%", width: "100%" }} theme={theme} data={studioData!} initialState={initialState} mode="view" />
          </AgStudioProvider>
        </div>
      )}
    </div>
  );
}
