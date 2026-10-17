import { handle } from "@/lib/http";
import { HttpError } from "@/lib/store";
import { monitorHolds } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called once a day by the Render cron job in render.yaml (or GitHub Actions).
export async function POST(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) throw new HttpError(401, "Missing or wrong x-cron-secret");
    return monitorHolds();
  });
}
