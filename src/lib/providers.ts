import type { Provider } from "./types";

// The verified provider registry: hospitals and clinics (campaign payees) plus pharmacies
// and medical-supply stores (payees for capped care-cost receipts). In production this is built by the platform from
// licensing databases and a one-time onboarding call with each hospital's billing office;
// here it is a fixed list of fictional hospitals.
//
// The payee is ALWAYS the registry's PayPal account, never an address printed on a document
// and never the organizer. Set PROVIDER_PAYPAL_EMAIL to a sandbox Business account you own
// so payouts land somewhere you can see.

const payee = () => process.env.PROVIDER_PAYPAL_EMAIL || "billing@riverside-childrens.example.com";

export function providers(): Provider[] {
  return [
    {
      id: "prov_riverside",
      type: "hospital",
      name: "Riverside Children's Hospital",
      city: "Austin",
      country: "US",
      registrationNo: "TX-HOSP-004417",
      phone: "+1 (512) 555-0142",
      address: "1200 Riverside Drive, Austin, TX 78741",
      paypalEmail: payee(),
      verifiedSince: "2025-03-11",
    },
    {
      id: "prov_lakeview",
      type: "hospital",
      name: "Lakeview General Hospital",
      city: "Madison",
      country: "US",
      registrationNo: "WI-HOSP-002291",
      phone: "+1 (608) 555-0178",
      address: "88 Lakeview Parkway, Madison, WI 53703",
      paypalEmail: process.env.PROVIDER2_PAYPAL_EMAIL || process.env.PROVIDER_PAYPAL_EMAIL || "accounts@lakeview-general.example.com",
      verifiedSince: "2025-06-02",
    },
    {
      id: "prov_harborpoint",
      type: "clinic",
      name: "Harbor Point Cancer Centre",
      city: "Toronto",
      country: "CA",
      registrationNo: "ON-ACU-118320",
      phone: "+1 (416) 555-0109",
      address: "400 Harbor Point Road, Toronto, ON M5J 2N8",
      paypalEmail: process.env.PROVIDER3_PAYPAL_EMAIL || "patientaccounts@harborpoint.example.com",
      verifiedSince: "2025-09-20",
    },
    {
      id: "prov_citycare",
      type: "pharmacy",
      name: "CityCare Pharmacy",
      city: "Austin",
      country: "US",
      registrationNo: "TX-PHR-31876",
      phone: "+1 (512) 555-0187",
      address: "455 Congress Avenue, Austin, TX 78701",
      paypalEmail: process.env.PHARMACY_PAYPAL_EMAIL || process.env.PROVIDER_PAYPAL_EMAIL || "payments@citycare-pharmacy.example.com",
      verifiedSince: "2025-11-04",
    },
    {
      id: "prov_mobility",
      type: "medical_supplies",
      name: "Mobility Plus Medical Supply",
      city: "Madison",
      country: "US",
      registrationNo: "WI-DME-20419",
      phone: "+1 (608) 555-0133",
      address: "17 Willow Street, Madison, WI 53704",
      paypalEmail: process.env.SUPPLIES_PAYPAL_EMAIL || "orders@mobilityplus.example.com",
      verifiedSince: "2026-01-15",
    },
  ];
}

export function provider(id: string): Provider | undefined {
  return providers().find((p) => p.id === id);
}

export const isCampaignPayee = (p: Provider) => p.type === "hospital" || p.type === "clinic";
export const TYPE_LABEL: Record<Provider["type"], string> = { hospital: "Hospital", clinic: "Clinic", pharmacy: "Pharmacy", medical_supplies: "Medical supplies" };

/** Find a verified provider by the name printed on a document. */
export function findByName(name: string, types?: Provider["type"][]): Provider | undefined {
  return providers().find((p) => (!types || types.includes(p.type)) && sameProviderName(name, p.name));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fuzzy name match: same normalized name, or one contains the other with enough length. */
export function sameProviderName(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length < y.length ? x : y;
  const long = short === x ? y : x;
  return short.length >= 10 && long.includes(short);
}

export const normDigits = (s: string) => s.replace(/\D/g, "").slice(-10);
