import { NextResponse } from "next/server";
import { providers } from "@/lib/providers";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(providers().map(({ paypalEmail, ...p }) => ({ ...p, payee: paypalEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2") })));
}
