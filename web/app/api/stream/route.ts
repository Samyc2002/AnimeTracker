import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const _9ANIME_BASE = "https://9anime.org.lv";
const KICKASS_BASE = "https://kickassanime.com.es/";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  try {
    // ================= 9ANIME ====================
    const searchUrl9anime = `${_9ANIME_BASE}/?s=${encodeURIComponent(title)}`;
    const res9anime = await fetch(searchUrl9anime, {
      headers: { "User-Agent": AGENT, Referer: _9ANIME_BASE },
      cache: "no-store",
    });

    if (!res9anime.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }

    const html9anime = await res9anime.text();
    const matches9anime = [
      ...html9anime.matchAll(
        /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/anime\/([^"\/"]*)\/?"[^>]*itemprop="url"/g
      ),
    ];
    if (matches9anime.length === 0) {
      return NextResponse.json({ error: "No results found", url: null });
    }

    let slug9Anime = matches9anime[1][1];
    // ================= 9ANIME ====================

    // ================= KICKASS ===================
    const searchUrlKickass = `${_9ANIME_BASE}/?s=${encodeURIComponent(title)}`;
    const resKickass = await fetch(searchUrlKickass, {
      headers: { "User-Agent": AGENT, Referer: _9ANIME_BASE },
      cache: "no-store",
    });

    if (!resKickass.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }

    const htmlKickass = await resKickass.text();
    const matchesKickass = [
      ...htmlKickass.matchAll(
        /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/anime\/([^"\/"]*)\/?"[^>]*itemprop="url"/g
      ),
    ];
    if (matchesKickass.length === 0) {
      return NextResponse.json({ error: "No results found", url: null });
    }

    let slugKickass = matchesKickass[1][1];
    // ================= KICKASS ===================
    return NextResponse.json({
      url9anime: `${_9ANIME_BASE}/${slug9Anime}`,
      urlKickass: `${KICKASS_BASE}/${slug9Anime}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
