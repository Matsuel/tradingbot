import { runTick } from "@/lib/bot";

export const maxDuration = 60;

// Called every 15 min by an external cron (cron-job.org) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await runTick());
}
