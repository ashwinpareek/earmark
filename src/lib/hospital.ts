import type { Check, Extraction, Provider } from "./types";

// Out-of-band confirmation: Earmark asks the hospital's own billing system whether it really
// issued this estimate, for this patient, for this amount. The contact comes from Earmark's
// provider registry (set up when the hospital was onboarded), never from the uploaded document,
// so a forger can't route the question to themselves.
//
// DEMO: real hospitals don't expose this API yet. This module simulates each registered
// hospital's billing system with the records of the genuine (fictional) documents it issued.
// The UI and the check text say "simulated" wherever this is shown.

export interface HospitalRecord {
  providerId: string;
  documentNumber: string;
  patientName: string;
  patientDob?: string;
  total: number;
  issued: string; // YYYY-MM-DD
}

export const HOSPITAL_RECORDS: HospitalRecord[] = [
  { providerId: "prov_riverside", documentNumber: "EST-2026-08812", patientName: "Maya Rodriguez", patientDob: "2017-03-04", total: 2400, issued: "2026-10-02" },
  { providerId: "prov_riverside", documentNumber: "INV-2026-11504", patientName: "Maya Rodriguez", patientDob: "2017-03-04", total: 2340, issued: "2026-10-08" },
  { providerId: "prov_riverside", documentNumber: "EST-2026-08907", patientName: "Aarav Shah", patientDob: "2020-01-19", total: 1800, issued: "2026-10-06" },
  // the public catalog (see scripts/make-samples.py)
  { providerId: "prov_lakeview", documentNumber: "LGH-EST-44120", patientName: "Leila Haddad", patientDob: "2019-02-02", total: 3200, issued: "2026-10-09" },
  { providerId: "prov_lakeview", documentNumber: "LGH-EST-44187", patientName: "Sam Okafor", patientDob: "2014-06-30", total: 2850, issued: "2026-10-12" },
  { providerId: "prov_riverside", documentNumber: "EST-2026-09114", patientName: "Lucia Gomez", patientDob: "2022-08-11", total: 990, issued: "2026-10-14" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + ".").join(" ");

export function hospitalConfirmation(e: Extraction, p: Provider, docId: string, records: HospitalRecord[] = HOSPITAL_RECORDS): Check {
  const base = { id: "hospital_confirmed", label: "Confirmed by the hospital", docIds: [docId], source: "rule" as const };
  const office = `${p.name}'s billing office`;
  const how = "(simulated; contacted through Earmark's registry, never through the document)";
  if (!e.documentNumber) {
    return { ...base, status: "warn", detail: `No estimate number could be read, so ${office} ${how} could not be asked about it.` };
  }
  const rec = records.find((r) => r.providerId === p.id && norm(r.documentNumber) === norm(e.documentNumber));
  if (!rec) {
    return { ...base, status: "fail", detail: `${office} ${how} has no record of estimate ${e.documentNumber}. The hospital says it didn't issue this document.` };
  }
  const problems: string[] = [];
  if (norm(rec.patientName) !== norm(e.patientName)) problems.push(`it was issued for a different patient (${initials(rec.patientName)}), not ${e.patientName || "the patient named here"}`);
  if (e.total != null && Math.round(e.total * 100) !== Math.round(rec.total * 100)) problems.push(`the hospital's amount is ${usd(rec.total)}, not the ${usd(e.total)} printed here`);
  if (problems.length) {
    return { ...base, status: "fail", detail: `${office} ${how} says ${e.documentNumber} is real, but ${problems.join(", and ")}.` };
  }
  return { ...base, status: "pass", detail: `${office} ${how} confirmed it issued ${e.documentNumber} to ${initials(rec.patientName)} for ${usd(rec.total)} on ${rec.issued}.` };
}
