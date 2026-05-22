"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchAnimeDetail, getErrorMessage } from "@/lib/anime-provider";
import { getCachedAnime } from "@/lib/providers/cache";
import { enqueueSnackbar } from "notistack";
import { useAuth } from "@/lib/auth-context";
import { useSfw } from "@/lib/sfw-context";
import { getTheme } from "@/lib/theme";
import { getWatchUrl } from "@/lib/stream-provider";
import { supabase } from "@/lib/supabase";
import AddToWatchlist from "@/components/AddToWatchlist";
import AddPrequels from "@/components/AddPrequels";
import RecommendToBuddy from "@/components/RecommendToBuddy";
import EpisodeGrid from "@/components/EpisodeGrid";
import SynopsisCollapse from "@/components/SynopsisCollapse";
import FranchiseTabs from "@/components/FranchiseTabs";
import { Spinner } from "@/components/ui/Spinner";
import type { AnimeDetail, WatchURLs } from "@/lib/types";
import { fireClientAchievementEvent } from "@/lib/achievements/fire-event";
import { getRandomQuote } from "@/lib/loading-quotes";

const statusLabels: Record<string, { label: string; className: string }> = {
  RELEASING: { label: "Airing", className: "bg-emerald-900 text-emerald-300" },
  FINISHED: { label: "Finished", className: "bg-blue-900 text-blue-300" },
  NOT_YET_RELEASED: {
    label: "Upcoming",
    className: "bg-amber-900 text-amber-300",
  },
  CANCELLED: { label: "Cancelled", className: "bg-red-900 text-red-300" },
  HIATUS: { label: "Hiatus", className: "bg-gray-700 text-gray-300" },
};

interface StreamTheme {
  brand: string;
  brandLight: string;
  brandDark: string;
  textTint: string;
  hoverText: string;
}

const streamThemes: Record<string, StreamTheme> = {
  Crunchyroll: {
    brand: "#f47521",
    brandLight: "#f89b5a",
    brandDark: "#c45e1a",
    textTint: "#f4a76b",
    hoverText: "#fff",
  },
  Netflix: {
    brand: "#e50914",
    brandLight: "#ff3b44",
    brandDark: "#b50710",
    textTint: "#f06b72",
    hoverText: "#fff",
  },
  Hulu: {
    brand: "#1ce783",
    brandLight: "#4aeea0",
    brandDark: "#14b566",
    textTint: "#6ee8a8",
    hoverText: "#000",
  },
  "Amazon Prime Video": {
    brand: "#00a8e1",
    brandLight: "#33bfef",
    brandDark: "#0086b4",
    textTint: "#5cc4e8",
    hoverText: "#fff",
  },
  "Bilibili Global": {
    brand: "#00a1d6",
    brandLight: "#33b7e2",
    brandDark: "#0081ab",
    textTint: "#5cbfde",
    hoverText: "#fff",
  },
  "Muse Asia": {
    brand: "#4a4adf",
    brandLight: "#6e6eeb",
    brandDark: "#3636b8",
    textTint: "#8e8eef",
    hoverText: "#fff",
  },
  "Disney Plus": {
    brand: "#113ccf",
    brandLight: "#3d5fdb",
    brandDark: "#0d2fa5",
    textTint: "#6b87e0",
    hoverText: "#fff",
  },
  Funimation: {
    brand: "#5b0bb5",
    brandLight: "#7a2dd0",
    brandDark: "#480891",
    textTint: "#9a5fd4",
    hoverText: "#fff",
  },
  HIDIVE: {
    brand: "#00baef",
    brandLight: "#33caf3",
    brandDark: "#0095bf",
    textTint: "#5cd0f0",
    hoverText: "#fff",
  },
  iQIYI: {
    brand: "#00be06",
    brandLight: "#33ce39",
    brandDark: "#009805",
    textTint: "#5cd460",
    hoverText: "#fff",
  },
  "9Anime": {
    brand: "#c026d3",
    brandLight: "#d04de0",
    brandDark: "#991ea8",
    textTint: "#d674e0",
    hoverText: "#fff",
  },
  Anikoto: {
    brand: "#4fb6e0",
    brandLight: "#72c7e8",
    brandDark: "#3a9dc9",
    textTint: "#a8ddf2",
    hoverText: "#0b1622",
  },
};

function streamStyle(theme: StreamTheme) {
  return {
    backgroundColor: `color-mix(in srgb, ${theme.brand} 15%, transparent)`,
    borderColor: `color-mix(in srgb, ${theme.brand} 30%, transparent)`,
    color: theme.textTint,
  };
}

function streamHoverStyle(theme: StreamTheme) {
  return {
    backgroundImage: `linear-gradient(to bottom, ${theme.brandLight}, ${theme.brandDark})`,
    borderColor: theme.brandLight,
    color: theme.hoverText,
  };
}

function streamDisabledStyle(theme: StreamTheme) {
  return {
    backgroundColor: "#141925",
    borderColor: `color-mix(in srgb, ${theme.brand} 40%, transparent)`,
    color: `color-mix(in srgb, ${theme.brand} 50%, #6b7280)`,
  };
}

const playIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const defaultStreamTheme: StreamTheme = {
  brand: "#253040",
  brandLight: "#354050",
  brandDark: "#1c2333",
  textTint: "#9ca3af",
  hoverText: "#e5e7eb",
};

function StreamButton({
  name,
  href,
  disabled,
}: {
  name: string;
  href?: string;
  disabled?: boolean;
}) {
  const theme = streamThemes[name] || defaultStreamTheme;
  const [hovered, setHovered] = useState(false);

  const style = disabled
    ? streamDisabledStyle(theme)
    : hovered
      ? streamHoverStyle(theme)
      : streamStyle(theme);

  const cls =
    "inline-flex items-center gap-1.5 px-4 py-2 border text-sm rounded-lg font-medium transition-all duration-200";

  if (disabled) {
    return (
      <span
        className={`${cls} cursor-not-allowed opacity-60`}
        style={style}
        title={`${name} not available for this title`}
      >
        {playIcon}
        {name}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {playIcon}
      {name}
    </a>
  );
}

function formatCountdown(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export default function AnimeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchUrls, setWatchUrls] = useState<WatchURLs | null>(null);
  const [streamingLinks, setStreamingLinks] = useState<
    { name: string; url: string }[]
  >([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<number[]>([]);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  // null = not cached (compute will run), number = cached root ID
  // undefined = no franchise (singleton — hide watch order tab)
  const [franchiseMembershipRootId, setFranchiseMembershipRootId] = useState<
    number | null | undefined
  >(undefined);

  const { authed, userId } = useAuth();
  const { sfwMode } = useSfw();
  const theme = getTheme(sfwMode);
  const id = Number(params.id);
  const [resolvedMediaId, setResolvedMediaId] = useState<number>(id);
  const [loadingQuote, setLoadingQuote] = useState("");
  useEffect(() => {
    setLoadingQuote(getRandomQuote("general"));
  }, []);

  useEffect(() => {
    async function load() {
      const start = Date.now();
      try {
        const detail = await fetchAnimeDetail(id);
        setAnime(detail);

        const { data: membership } = await supabase
          .from("franchise_membership")
          .select("franchise_root_id")
          .eq("series_anilist_id", detail.id)
          .limit(1);

        if (membership && membership.length > 0) {
          setFranchiseMembershipRootId(
            membership[0].franchise_root_id as number,
          );
        } else {
          const hasFranchiseRelations = detail.relations.edges.some(
            (e) =>
              e.node.type === "ANIME" &&
              [
                "PREQUEL",
                "SEQUEL",
                "SIDE_STORY",
                "PARENT",
                "ALTERNATIVE",
                "SUMMARY",
                "SPIN_OFF",
              ].includes(e.relationType),
          );
          if (hasFranchiseRelations) {
            setFranchiseMembershipRootId(null);
          } else {
            setFranchiseMembershipRootId(undefined);
          }
        }

        const title = detail.title.english || detail.title.romaji || "";
        getWatchUrl(title).then((urls) => setWatchUrls(urls));

        const malId = detail.idMal || id;
        fetch(`https://api.jikan.moe/v4/anime/${malId}/streaming`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.data) setStreamingLinks(d.data);
          })
          .catch(() => {});
      } catch (err) {
        setAnime(null);
        enqueueSnackbar(getErrorMessage(err), { variant: "error" });
      }
      const elapsed = Date.now() - start;
      if (elapsed < 1000)
        await new Promise((r) => setTimeout(r, 1000 - elapsed));
      setLoading(false);
    }
    load();
  }, [id, watchedEpisodes]);

  const loadWatchedEpisodes = useCallback(async () => {
    if (!authed || !userId) return;
    try {
      const { data: wlData } = await supabase
        .from("watchlist_entries")
        .select("id, media_id, canonical_anilist_id")
        .eq("user_id", userId)
        .or(`canonical_anilist_id.eq.${id},id_mal.eq.${id},media_id.eq.${id}`)
        .not("canonical_anilist_id", "is", null)
        .limit(1);
      setIsInWatchlist(!!(wlData && wlData.length > 0));
      if (!wlData || wlData.length === 0) return;

      const trackedMediaId = wlData[0].media_id as number;
      setResolvedMediaId(trackedMediaId);
      const { data: epData } = await supabase
        .from("watched_episodes")
        .select("episode_number")
        .eq("user_id", userId)
        .eq("media_id", trackedMediaId)
        .limit(5000);
      setWatchedEpisodes(
        (epData || [])
          .map((d) => d.episode_number as number)
          .sort((a, b) => a - b),
      );
    } catch {
      // Non-critical
    }
  }, [authed, userId, id]);

  useEffect(() => {
    loadWatchedEpisodes();
  }, [loadWatchedEpisodes]);

  useEffect(() => {
    if (!authed || !isInWatchlist) return;
    const markEp = searchParams.get("mark_episode");
    if (!markEp) return;
    const epNum = parseInt(markEp);
    if (isNaN(epNum)) return;

    async function autoMark() {
      if (!userId) return;
      try {
        const { data: existingEps } = await supabase
          .from("watched_episodes")
          .select("episode_number")
          .eq("user_id", userId)
          .eq("media_id", resolvedMediaId)
          .limit(5000);
        const watched = new Set(
          (existingEps || []).map((d) => d.episode_number as number),
        );
        const toMark: number[] = [];
        for (let i = 1; i <= epNum; i++) {
          if (!watched.has(i)) toMark.push(i);
        }
        if (toMark.length > 0) {
          await supabase.from("watched_episodes").upsert(
            toMark.map((e) => ({
              user_id: userId,
              media_id: resolvedMediaId,
              episode_number: e,
            })),
          );
          setWatchedEpisodes((prev) => {
            const set = new Set([...prev, ...toMark]);
            return [...set].sort((a, b) => a - b);
          });
          enqueueSnackbar(`Marked episodes 1-${epNum} as watched`, {
            variant: "success",
          });
        }
      } catch {
        // Non-critical
      }
      window.history.replaceState({}, "", `/anime/${id}`);
    }
    autoMark();
  }, [authed, id, resolvedMediaId, isInWatchlist, searchParams]);

  async function toggleEpisode(ep: number) {
    if (!authed || !userId) return;
    try {
      const allWatchedUpTo = Array.from({ length: ep }, (_, i) => i + 1).every(
        (e) => watchedEpisodes.includes(e),
      );
      if (allWatchedUpTo && watchedEpisodes.includes(ep)) {
        const { data: docs } = await supabase
          .from("watched_episodes")
          .select("id")
          .eq("user_id", userId)
          .eq("media_id", resolvedMediaId)
          .eq("episode_number", ep)
          .limit(1);
        if (docs && docs.length > 0) {
          await supabase.from("watched_episodes").delete().eq("id", docs[0].id);
        }
        setWatchedEpisodes((prev) => prev.filter((e) => e !== ep));
      } else {
        const toMark: number[] = [];
        for (let i = 1; i <= ep; i++) {
          if (!watchedEpisodes.includes(i)) toMark.push(i);
        }
        if (toMark.length > 0) {
          await supabase.from("watched_episodes").upsert(
            toMark.map((e) => ({
              user_id: userId,
              media_id: resolvedMediaId,
              episode_number: e,
            })),
          );
        }
        setWatchedEpisodes((prev) => {
          const set = new Set([...prev, ...toMark]);
          return [...set].sort((a, b) => a - b);
        });
        if (toMark.length > 1) {
          enqueueSnackbar(`Marked episodes 1-${ep} as watched`, {
            variant: "success",
          });
        }
        if (userId) fireClientAchievementEvent(userId, "episode_watched");
      }
    } catch {
      enqueueSnackbar("Failed to update episode", { variant: "error" });
    }
  }

  useEffect(() => {
    if (!anime) return;
    const edges = anime.relations.edges.filter((e) => e.node.type === "ANIME");
    const needsCovers = edges.some(
      (e) =>
        !e.node.coverImage?.extraLarge &&
        !e.node.coverImage?.large &&
        !e.node.coverImage?.medium,
    );
    if (!needsCovers) return;

    async function enrichRelations() {
      const newEdges = [...anime!.relations.edges];
      const uncachedIds: number[] = [];
      let updated = false;

      for (let i = 0; i < newEdges.length; i++) {
        const edge = newEdges[i];
        if (edge.node.type !== "ANIME") continue;
        const hasImage = [
          edge.node.coverImage?.extraLarge,
          edge.node.coverImage?.large,
          edge.node.coverImage?.medium,
        ].some((u) => u && u.length > 0);
        if (hasImage) continue;

        const cached = await getCachedAnime({ malId: edge.node.id });
        if (cached?.detail?.coverImage) {
          newEdges[i] = {
            ...edge,
            node: { ...edge.node, coverImage: cached.detail.coverImage },
          };
          updated = true;
        } else {
          uncachedIds.push(edge.node.id);
        }
      }

      if (updated) {
        setAnime((prev) =>
          prev ? { ...prev, relations: { edges: newEdges } } : prev,
        );
      }

      if (uncachedIds.length > 0) {
        fetch("/api/cache-relations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ malIds: uncachedIds }),
        }).catch(() => {});
      }
    }
    enrichRelations();
  }, [anime?.id]);

  useEffect(() => {
    const layoutEl = document.querySelector(
      "[data-dashboard-layout]",
    ) as HTMLElement | null;
    if (layoutEl) layoutEl.style.background = "transparent";
    return () => {
      if (layoutEl) layoutEl.style.background = "";
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner />
        <p className="text-base text-gray-400 italic mt-2">{loadingQuote}</p>
      </div>
    );
  }

  if (!anime) {
    return <p className="text-gray-500 text-center mt-12">Anime not found.</p>;
  }

  const title = anime.title.english || anime.title.romaji;
  const statusInfo = statusLabels[anime.status] || statusLabels.FINISHED;
  const studio = anime.studios.nodes[0]?.name;

  const backdropImage =
    anime.bannerImage ||
    anime.coverImage.extraLarge ||
    anime.coverImage.large ||
    anime.coverImage.medium;

  return (
    <div className="-mx-4 sm:-mx-6 -mt-6 sm:-mt-8 relative min-h-screen">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backdropImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-15"
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24">
        <div
          className={`flex flex-col items-center sm:flex-row sm:items-start gap-4 sm:gap-6 ${
            anime.bannerImage ? "-mt-20 relative z-10" : "mt-8"
          }`}
        >
          <div className="w-[120px] h-[170px] sm:w-[160px] sm:h-[230px] flex-shrink-0 relative">
            <Image
              src={
                anime.coverImage.extraLarge ||
                anime.coverImage.large ||
                anime.coverImage.medium
              }
              alt={title}
              fill
              className="rounded-lg shadow-lg object-cover"
              unoptimized
            />
          </div>

          <div className="flex-1 min-w-0 pt-4 text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-100 mb-1">
              {title}
            </h1>
            {anime.title.native && (
              <p className="text-sm text-gray-500 mb-3">{anime.title.native}</p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
              {anime.averageScore && (
                <span className="text-sm text-yellow-400 font-semibold">
                  ★ {(anime.averageScore / 10).toFixed(1)}
                </span>
              )}
              {studio && (
                <span className="text-sm text-gray-400">{studio}</span>
              )}
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-1 text-sm text-gray-400 mb-4">
              {anime.episodes && <span>{anime.episodes} episodes</span>}
              {anime.duration && <span>{anime.duration} min/ep</span>}
              {anime.season && anime.seasonYear && (
                <span>
                  {anime.season.charAt(0) + anime.season.slice(1).toLowerCase()}{" "}
                  {anime.seasonYear}
                </span>
              )}
            </div>

            {authed ? (
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <AddToWatchlist
                  media={{
                    id: anime.id,
                    idMal: anime.idMal,
                    title: {
                      romaji: anime.title.romaji,
                      english: anime.title.english,
                    },
                    coverImage: anime.coverImage,
                    status: anime.status,
                    episodes: anime.episodes,
                    nextAiringEpisode: anime.nextAiringEpisode,
                  }}
                />
                <AddPrequels anime={anime} />
                <RecommendToBuddy
                  mediaId={anime.id}
                  title={anime.title.english || anime.title.romaji}
                  coverUrl={
                    anime.coverImage?.extraLarge ||
                    anime.coverImage?.large ||
                    ""
                  }
                />
              </div>
            ) : (
              <Link
                href="/login"
                className={`px-5 py-2 ${theme.btn} text-white text-sm rounded-lg font-medium transition-colors inline-block`}
              >
                Sign in to track
              </Link>
            )}
          </div>
        </div>

        {anime.nextAiringEpisode && (
          <div className="mt-6 bg-[#141925] rounded-lg p-4 flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${theme.pulse} animate-pulse`}
            />
            <span className="text-sm text-gray-300">
              Episode {anime.nextAiringEpisode.episode} airing in{" "}
              <span className={`${theme.btnText} font-semibold`}>
                {formatCountdown(anime.nextAiringEpisode.timeUntilAiring)}
              </span>
            </span>
          </div>
        )}

        {anime.genres.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {anime.genres.map((g) => (
              <span
                key={g}
                className="px-3 py-1 bg-[#111827] border border-[#253040] rounded-full text-xs text-gray-300"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">
            Watch
          </h2>
          <div className="flex flex-wrap gap-2">
            {streamingLinks.map((link) => (
              <StreamButton key={link.name} name={link.name} href={link.url} />
            ))}
            <StreamButton
              name="9Anime"
              href={watchUrls?.url9anime}
              disabled={!watchUrls?.url9anime}
            />
            <StreamButton
              name="Anikoto"
              href={watchUrls?.urlAnikoto}
              disabled={!watchUrls?.urlAnikoto}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            * Streaming links are sourced from third-party databases and may be
            outdated or region-restricted. If a link doesn&apos;t work, please
            search for the title on the platform directly.
          </p>
        </div>

        {authed &&
          isInWatchlist &&
          (() => {
            const nextEp = anime.nextAiringEpisode?.episode ?? null;
            const airedSoFar = nextEp ? nextEp - 1 : null;
            const highestWatched =
              watchedEpisodes.length > 0 ? Math.max(...watchedEpisodes) : 0;
            const effectiveTotal =
              anime.episodes ||
              (nextEp ? nextEp : null) ||
              Math.max(highestWatched + 1, 1);
            if (effectiveTotal <= 0) return null;
            const displayTotal =
              anime.episodes || (nextEp ? nextEp : highestWatched + 1);

            let consecutive = 0;
            for (let i = 1; i <= effectiveTotal; i++) {
              if (watchedEpisodes.includes(i)) consecutive = i;
              else break;
            }

            return (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">
                  Episodes
                </h2>
                {watchedEpisodes.length > 0 && (
                  <div className="mb-3 text-xs text-gray-500 space-y-0.5">
                    <p>
                      Watched up to Episode{" "}
                      <span className={`${theme.btnText} font-semibold`}>
                        {consecutive ||
                          watchedEpisodes[watchedEpisodes.length - 1]}
                      </span>
                    </p>
                    <p>
                      <span className={`${theme.btnText} font-semibold`}>
                        {watchedEpisodes.length}
                      </span>
                      /{displayTotal} episodes watched
                    </p>
                  </div>
                )}
                <EpisodeGrid
                  totalEpisodes={effectiveTotal}
                  watchedEpisodes={watchedEpisodes}
                  onToggle={toggleEpisode}
                  availableUpTo={
                    anime.nextAiringEpisode
                      ? anime.nextAiringEpisode.episode - 1
                      : undefined
                  }
                />
                {!anime.episodes && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    * Total episodes unknown. Showing episodes aired so far.
                  </p>
                )}
              </div>
            );
          })()}

        {anime.description && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">
              Synopsis
            </h2>
            <SynopsisCollapse html={anime.description} collapseKey={id} />
          </div>
        )}

        <FranchiseTabs
          anime={anime}
          currentAnilistId={anime.id}
          initialMembershipRootId={franchiseMembershipRootId}
        />
      </div>
    </div>
  );
}
