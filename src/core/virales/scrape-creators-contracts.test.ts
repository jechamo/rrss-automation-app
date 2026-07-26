import test from "node:test";
import assert from "node:assert/strict";
import {
  mapWindowToProvider,
  mergeViralCandidates,
  normalizeInstagramResponse,
  normalizeTikTokResponse,
  normalizeYouTubeResponse,
} from "./scrape-creators-contracts.js";
import type { CriterioViral } from "./types.js";

const criterio = (ventanaDias: number): CriterioViral => ({
  metrica: "vistas relativas",
  umbral: ">= 5x",
  ventanaDias,
});

test("normaliza busqueda de YouTube sin perder metricas exactas", () => {
  const result = normalizeYouTubeResponse({
    credits_charged: 1,
    credits_remaining: 99,
    videos: [{
      id: "abc123",
      url: "https://youtube.com/watch?v=abc123",
      title: "Rutina corta",
      channel: { id: "channel-1", title: "Entrena Ya", handle: "entrenaya" },
      viewCountInt: 125000,
      viewCountText: "125K views",
      publishedTime: "2026-07-20T10:00:00.000Z",
      publishedTimeText: "6 days ago",
      lengthSeconds: 45,
      thumbnail: "https://img.example/youtube.jpg",
    }],
  });

  assert.equal(result.creditsCharged, 1);
  assert.equal(result.creditsRemaining, 99);
  assert.equal(result.candidatos[0].plataforma, "youtube");
  assert.equal(result.candidatos[0].metrics?.views, 125000);
  assert.equal(result.candidatos[0].metrics?.ratioConfidence, "unverified");
  assert.equal(result.candidatos[0].ratioAutor, 0);
});

test("normaliza TikTok y construye su URL canonica", () => {
  const result = normalizeTikTokResponse({
    credits_charged: 1,
    search_item_list: [{
      aweme_info: {
        aweme_id: "7334621391758642478",
        desc: "Entrenamiento de fuerza",
        create_time: 1721300000,
        author: { uid: "u1", unique_id: "coach", nickname: "Coach" },
        statistics: {
          play_count: 31677,
          digg_count: 355,
          comment_count: 5,
          share_count: 22,
          collect_count: 30,
        },
        video: { duration: 21000, cover: { url_list: ["https://img.example/tiktok.jpg"] } },
      },
    }],
  });

  const viral = result.candidatos[0];
  assert.equal(viral.url, "https://www.tiktok.com/@coach/video/7334621391758642478");
  assert.equal(viral.metrics?.durationSeconds, 21);
  assert.equal(viral.metrics?.shares, 22);
  assert.equal(viral.sourceProvider, "scrapecreators");
});

test("normaliza Instagram Reels con alcance y autor", () => {
  const result = normalizeInstagramResponse({
    credits_charged: 1,
    reels: [{
      id: "ig1",
      shortcode: "ABC123",
      caption: "Una rutina para empezar",
      video_play_count: 46018,
      video_view_count: 21808,
      video_duration: 75.7,
      like_count: 3487,
      comment_count: 90,
      taken_at: "2026-07-20T10:00:00.000Z",
      owner: { id: "owner-1", username: "coach", full_name: "Coach", follower_count: 188406 },
    }],
  });

  const viral = result.candidatos[0];
  assert.equal(viral.url, "https://www.instagram.com/reel/ABC123/");
  assert.equal(viral.metrics?.views, 46018);
  assert.equal(viral.metrics?.followers, 188406);
  assert.equal(viral.autor, "Coach");
});

test("deduplica por ID de plataforma aunque cambie la URL", () => {
  const base = normalizeYouTubeResponse({
    videos: [{
      id: "same-id",
      url: "https://youtube.com/watch?v=same-id&utm_source=x",
      title: "Uno",
      viewCountInt: 1,
    }],
  }).candidatos[0];
  const merged = mergeViralCandidates([base], [{ ...base, url: "https://youtu.be/same-id" }]);
  assert.equal(merged.length, 1);
});

test("traduce ventanas a los enums de cada plataforma", () => {
  assert.deepEqual(mapWindowToProvider("youtube", criterio(7)), { uploadDate: "this_week" });
  assert.deepEqual(mapWindowToProvider("tiktok", criterio(30)), { date_posted: "this-month" });
  assert.deepEqual(mapWindowToProvider("instagram", criterio(14)), { date_posted: "last-month" });
  assert.deepEqual(mapWindowToProvider("instagram", criterio(0)), {});
});
