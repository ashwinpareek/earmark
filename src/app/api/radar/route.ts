import { handle } from "@/lib/http";
import { reuseRadar } from "@/lib/workflow";
export const dynamic = "force-dynamic";
export async function GET() { return handle(reuseRadar); }
