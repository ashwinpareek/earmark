import { Suspense } from "react";
import CampaignRoom from "@/components/CampaignRoom";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense><CampaignRoom id={id} /></Suspense>;
}
