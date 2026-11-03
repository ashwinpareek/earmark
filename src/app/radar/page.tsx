import Radar from "@/components/Radar";
import { reuseRadar } from "@/lib/workflow";
import { demoSpace } from "@/lib/space";
export const dynamic = "force-dynamic";
export const metadata = { title: "Reuse radar — Earmark" };
// The radar arrives with its data; the component then refreshes it every few seconds.
export default async function RadarPage() {
  const space = (await demoSpace()) ?? "main";
  const items = await reuseRadar(space).catch(() => []);
  return <Radar initial={{ space: space === "main" ? "main" : "demo", items: items as never }} />;
}
