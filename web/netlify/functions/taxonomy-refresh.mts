import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const ANILIST_API = "https://graphql.anilist.co";
const STUDIO_PAGE_SLEEP_MS = 1000;

const TAG_QUERY = `{ MediaTagCollection { id name description category isAdult } }`;

const STUDIO_QUERY = `
query Studios($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    studios { id name favourites }
  }
}`;

interface AniListTag {
  id: number;
  name: string;
  description: string | null;
  category: string;
  isAdult: boolean;
}

interface AniListStudio {
  id: number;
  name: string;
  favourites: number;
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "5");
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return gql(query, variables);
  }

  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default async (req: Request) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const isScheduled = !auth;
  if (!isScheduled && auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Supabase env vars missing" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const start = Date.now();

  // 1. Tags — single request
  console.log("Fetching tags from AniList...");
  const tagData = await gql<{ MediaTagCollection: AniListTag[] }>(TAG_QUERY);
  const tagRows = tagData.MediaTagCollection.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    is_adult: t.isAdult,
    updated_at: new Date().toISOString(),
  }));

  const { error: tagError } = await supabase
    .from("anime_taxonomy_tags")
    .upsert(tagRows, { onConflict: "id" });
  if (tagError) throw new Error(`Tag upsert failed: ${tagError.message}`);
  console.log(`Upserted ${tagRows.length} tags.`);

  // 2. Studios — paginated
  console.log("Fetching studios from AniList...");
  let page = 1;
  let totalStudios = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await gql<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        studios: AniListStudio[];
      };
    }>(STUDIO_QUERY, { page });

    const studioRows = data.Page.studios.map((s) => ({
      id: s.id,
      name: s.name,
      favourites: s.favourites,
      updated_at: new Date().toISOString(),
    }));

    const { error: studioError } = await supabase
      .from("anime_taxonomy_studios")
      .upsert(studioRows, { onConflict: "id" });
    if (studioError) throw new Error(`Studio upsert failed (page ${page}): ${studioError.message}`);

    totalStudios += studioRows.length;
    hasNextPage = data.Page.pageInfo.hasNextPage;
    page++;

    if (hasNextPage) await sleep(STUDIO_PAGE_SLEEP_MS);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Upserted ${totalStudios} studios across ${page - 1} pages.`);
  console.log(`Taxonomy refresh complete in ${elapsed}s.`);

  return new Response(
    JSON.stringify({ tags: tagRows.length, studios: totalStudios, elapsed: `${elapsed}s` }),
  );
};

export const config: Config = {
  schedule: "30 22 * * *",
};
