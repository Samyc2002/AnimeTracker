import type { Config } from "@netlify/functions";

export default async () => {
  const appUrl = process.env.URL || "https://animetracker.lol";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), { status: 500 });
  }

  let totalCreated = 0;
  let batches = 0;
  const maxBatches = 100;

  console.log("Starting sequel notification scan...");

  while (batches < maxBatches) {
    const offset = batches * 100;

    const response = await fetch(`${appUrl}/api/notifications/sequels?offset=${offset}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.json();
    batches++;

    if (!response.ok) {
      console.error(`Batch ${batches} failed:`, body);
      break;
    }

    totalCreated += body.created || 0;
    console.log(`Batch ${batches}: processed ${body.processed}, created ${body.created} notifications`);

    if (body.done) {
      console.log("All completed entries scanned.");
      break;
    }
  }

  console.log(`Done. Total sequel notifications created: ${totalCreated} in ${batches} batches.`);
  return new Response(JSON.stringify({ totalCreated, batches }));
};

export const config: Config = {
  schedule: "0 0 1 * *",
};
