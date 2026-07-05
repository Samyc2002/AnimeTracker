import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const _9ANIME_BASE = "https://9anime.org.lv";
const ANIKOTO_BASE = "https://anikoto.cz";

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
      /<a[^>]*href="(?:https?:\/\/[^"]*?)?\/anime\/([^"\/"]*)\/?"[^>]*itemprop="url"/g,
    ),
  ];
  if (matches.length < 2) throw new Error("9anime: no results");
  return `${_9ANIME_BASE}/${matches[1][1]}`;
}

async function fetchAnikoto(title: string): Promise<string> {
  const searchUrl = `${ANIKOTO_BASE}/filter?keyword=${encodeURIComponent(title)}`;
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": AGENT, Referer: ANIKOTO_BASE },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Anikoto search failed");
  const html = await res.text();
  const matches = [
    ...html.matchAll(
      /href="(?:https?:\/\/[^"]*?)?\/watch\/([^"\/]*)\/?(?:[^"]*)"/g,
    ),
  ];
  if (matches.length < 2) throw new Error("Anikoto: no results");
  return `${ANIKOTO_BASE}/watch/${matches[1][1]}`;
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const [res9anime, resAnikoto] = await Promise.allSettled([
    fetch9anime(title),
    fetchAnikoto(title),
  ]);

  const url9anime = res9anime.status === "fulfilled" ? res9anime.value : null;
  const urlAnikoto =
    resAnikoto.status === "fulfilled" ? resAnikoto.value : null;

  console.info("urlAnikoto", urlAnikoto);

  if (!url9anime && !urlAnikoto) {
    return NextResponse.json(
      { error: "No streaming links found" },
      { status: 502 },
    );
  }

  return NextResponse.json({ url9anime, urlAnikoto });
}
