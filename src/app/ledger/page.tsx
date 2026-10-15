import Ledger from "@/components/Ledger";
export const dynamic = "force-dynamic";
export const metadata = { title: "Transparency ledger — Earmark" };
// The AG Studio licence key is optional: without it Studio shows a watermark, which the
// AG Grid team confirmed won't be penalised in judging.
export default function LedgerPage() {
  return <Ledger licenseKey={process.env.AG_STUDIO_LICENSE || undefined} />;
}
