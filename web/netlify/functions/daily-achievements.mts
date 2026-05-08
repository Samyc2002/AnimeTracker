import type { Config } from "@netlify/functions";

export default async () => {
  const appUrl = process.env.URL || "https://animetracker.lol";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), { status: 500 });
  }

  console.log("Running daily achievement checks...");

  try {
    const response = await fetch(`${appUrl}/api/achievements/daily`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.json();
    console.log("Daily achievements result:", body);

    return new Response(JSON.stringify(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Daily achievements failed:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};

export const config: Config = {
  schedule: "0 0 * * *",
};
