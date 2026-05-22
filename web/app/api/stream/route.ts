import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const _9ANIME_BASE = "https://9anime.org.lv";
const KICKASS_BASE = "https://kickassanime.com.es";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

async function fetch9anime(title: string): Promise<string> {
  const searchUrl = `${_9ANIME_BASE}/?s=${encodeURIComponent(title)}`;
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": AGENT, Referer: _9ANIME_BASE },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("9anime search failed");
  const html = await res.text();
  const matches = [
    ...html.matchAll(
      /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/anime\/([^"\/"]*)\/?"[^>]*itemprop="url"/g
    ),
  ];
  if (matches.length < 2) throw new Error("9anime: no results");
  return `${_9ANIME_BASE}/${matches[1][1]}`;
}

async function fetchKickass(title: string): Promise<string> {
  const searchUrl = `${KICKASS_BASE}/?s=${encodeURIComponent(title)}`;
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": AGENT, Referer: KICKASS_BASE },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Kickass search failed");
  const html = await res.text();
  const matches = [
    ...html.matchAll(
      /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/anime\/([^"\/"]*)\/?"[^>]*itemprop="url"/g
    ),
  ];
  if (matches.length < 2) throw new Error("Kickass: no results");
  return `${KICKASS_BASE}/${matches[1][1]}`;
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const [res9anime, resKickass] = await Promise.allSettled([
    fetch9anime(title),
    fetchKickass(title),
  ]);

  const url9anime = res9anime.status === "fulfilled" ? res9anime.value : null;
  const urlKickass = resKickass.status === "fulfilled" ? resKickass.value : null;

  if (!url9anime && !urlKickass) {
    return NextResponse.json({ error: "No streaming links found" }, { status: 502 });
  }

  return NextResponse.json({ url9anime, urlKickass });
}
