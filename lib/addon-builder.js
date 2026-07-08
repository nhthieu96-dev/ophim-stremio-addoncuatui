// ===========================================================================
// OPhim Stremio Add-on - Logic dùng chung
// Nguồn dữ liệu: https://ophim1.com  (API)
// Trang truy cập gốc: https://ophim17.cc
//
// File này CHỈ định nghĩa addon (manifest + handlers) và export builder.
// Việc khởi động server (serveHTTP cho Render/Docker, hoặc getRouter cho
// Vercel serverless) nằm ở các file khác dùng module này.
// ===========================================================================

const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------
const API_BASE = "https://ophim1.com";      // Base URL API dữ liệu
const SITE_URL = "https://ophim17.cc";      // Domain trang xem phim (dùng làm Referer khi phát m3u8)
const PREFIX = "ophim:";                    // Tiền tố id Stremio
const DEFAULT_IMG_HOST = "https://img.ophim.live/uploads/movies/";

const CATALOGS = [
  { id: "ophim-phim-moi", type: "movie", name: "OPhim - Mới Cập Nhật", path: "phim-moi-cap-nhat" },
  { id: "ophim-phim-le", type: "movie", name: "OPhim - Phim Lẻ", path: "phim-le" },
  { id: "ophim-phim-bo", type: "series", name: "OPhim - Phim Bộ", path: "phim-bo" },
  { id: "ophim-hoat-hinh", type: "series", name: "OPhim - Hoạt Hình", path: "hoat-hinh" },
  { id: "ophim-tv-shows", type: "series", name: "OPhim - TV Shows", path: "tv-shows" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: SITE_URL,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} cho ${url} - body: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Response không phải JSON hợp lệ từ ${url} - body: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// Tìm kiếm: gọi SONG SONG nhiều dạng endpoint (thay vì tuần tự) để không bị
// cộng dồn thời gian chờ và khiến Stremio hiển thị loading vô tận / timeout.
// Trên Vercel điều này còn quan trọng hơn vì hàm serverless có giới hạn thời
// gian chạy (mặc định 10s trên gói Hobby).
async function searchOphim(keyword, page) {
  const candidates = [
    `${API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    `${API_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    `${API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}`,
  ];

  const settled = await Promise.allSettled(
    candidates.map((url) => fetchJson(url, 6000).then((data) => ({ url, data })))
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      const { url, data } = result.value;
      const items =
        data.items ||
        (data.data && data.data.items) ||
        (data.data && data.data.movies) ||
        [];
      if (Array.isArray(items)) {
        console.log(`search OK qua: ${url} (${items.length} kết quả)`);
        return { items, pathImage: data.pathImage || (data.data && data.data.APP_DOMAIN_CDN_IMAGE) };
      }
    } else {
      console.error(`search thử endpoint thất bại: ${candidates[i]} -> ${result.reason && result.reason.message}`);
    }
  }
  console.error("search: tất cả endpoint đều thất bại.");
  return { items: [], pathImage: null };
}

// list item thumb/poster có thể là filename tương đối (kèm pathImage) hoặc URL đầy đủ
function toImageUrl(value, pathImage) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const host = pathImage || DEFAULT_IMG_HOST;
  return host.endsWith("/") ? host + value : host + "/" + value;
}

function mapType(ophimType) {
  // "single" = phim lẻ -> movie | "series"/khác = phim bộ -> series
  return ophimType === "single" ? "movie" : "series";
}

// Chuyển 1 item danh sách -> MetaPreview Stremio
function itemToMetaPreview(item, pathImage) {
  return {
    id: PREFIX + item.slug,
    type: "movie", // được sửa lại đúng loại khi mở meta chi tiết; danh sách chỉ cần hiển thị
    name: item.name,
    poster: toImageUrl(item.poster_url || item.thumb_url, pathImage),
    description: item.origin_name,
    releaseInfo: item.year ? String(item.year) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
const manifest = {
  id: "org.ophim.stremio.addon",
  version: "1.0.0",
  name: "OPhim - Xem Phim Vietsub",
  description:
    "Add-on không chính thức lấy dữ liệu phim từ OPhim (ophim1.com / ophim17.cc): phim lẻ, phim bộ, hoạt hình, TV shows - Vietsub/Thuyết minh.",
  logo: "https://ophim17.cc/favicon.ico",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: [PREFIX],
  catalogs: CATALOGS.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    extra: [
      { name: "search", isRequired: false },
      { name: "skip", isRequired: false },
    ],
  })),
  behaviorHints: { configurable: false },
};

const builder = new addonBuilder(manifest);

// ---------------------------------------------------------------------------
// CATALOG handler
// ---------------------------------------------------------------------------
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    const catalogDef = CATALOGS.find((c) => c.id === id);
    if (!catalogDef) return { metas: [] };

    const skip = extra && extra.skip ? parseInt(extra.skip, 10) : 0;
    const page = Math.floor(skip / 24) + 1;
    const searchTerm = extra && extra.search;

    let items, pathImage;
    if (searchTerm) {
      const result = await searchOphim(searchTerm, page);
      items = result.items;
      pathImage = result.pathImage;
    } else {
      const url = `${API_BASE}/danh-sach/${catalogDef.path}?page=${page}`;
      const data = await fetchJson(url);
      items = data.items || (data.data && data.data.items) || [];
      pathImage = data.pathImage || (data.data && data.data.APP_DOMAIN_CDN_IMAGE);
    }

    const metas = items.map((item) => {
      const m = itemToMetaPreview(item, pathImage);
      m.type = catalogDef.type; // ép loại theo catalog để Stremio route đúng danh mục
      return m;
    });

    return { metas };
  } catch (err) {
    console.error("catalog error:", err.message);
    return { metas: [] };
  }
});

// ---------------------------------------------------------------------------
// META handler
// ---------------------------------------------------------------------------
builder.defineMetaHandler(async ({ id }) => {
  try {
    if (!id.startsWith(PREFIX)) return { meta: null };
    const slug = id.slice(PREFIX.length);
    const data = await fetchJson(`${API_BASE}/phim/${slug}`);
    if (!data || !data.movie) return { meta: null };

    const movie = data.movie;
    const type = mapType(movie.type);

    const meta = {
      id,
      type,
      name: movie.name,
      poster: toImageUrl(movie.poster_url || movie.thumb_url),
      background: toImageUrl(movie.thumb_url || movie.poster_url),
      description: (movie.content || "").replace(/<[^>]+>/g, ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      genres: (movie.category || []).map((c) => c.name),
      cast: movie.actor && movie.actor.filter(Boolean),
      director: movie.director && movie.director.filter(Boolean).join(", "),
      country: (movie.country || []).map((c) => c.name).join(", "),
      imdbRating: undefined,
      runtime: movie.time || undefined,
    };

    if (type === "series") {
      const videos = [];
      // Gộp tất cả các tập theo tên tập (không trùng lặp) từ server đầu tiên
      const firstServer = (data.episodes && data.episodes[0]) || null;
      const epList = firstServer ? firstServer.server_data : [];
      epList.forEach((ep, idx) => {
        videos.push({
          id: `${id}:${ep.slug}`,
          title: ep.name || `Tập ${idx + 1}`,
          season: 1,
          episode: idx + 1,
          released: movie.modified && movie.modified.time ? movie.modified.time : undefined,
        });
      });
      meta.videos = videos;
    }

    return { meta };
  } catch (err) {
    console.error("meta error:", err.message);
    return { meta: null };
  }
});

// ---------------------------------------------------------------------------
// STREAM handler
// ---------------------------------------------------------------------------
builder.defineStreamHandler(async ({ id }) => {
  try {
    if (!id.startsWith(PREFIX)) return { streams: [] };
    const rest = id.slice(PREFIX.length);
    const [slug, episodeSlug] = rest.split(":");

    const data = await fetchJson(`${API_BASE}/phim/${slug}`);
    if (!data || !data.episodes) return { streams: [] };

    const targetSlug = episodeSlug || "full";
    const streams = [];

    for (const server of data.episodes) {
      const ep = (server.server_data || []).find((e) => e.slug === targetSlug);
      if (!ep) continue;

      if (ep.link_m3u8) {
        streams.push({
          name: `OPhim`,
          title: `${server.server_name || "Server"} - HLS`,
          url: ep.link_m3u8,
          behaviorHints: {
            notWebReady: false,
            bingeGroup: `ophim-${slug}`,
            proxyHeaders: {
              request: { Referer: SITE_URL, "User-Agent": "Mozilla/5.0" },
            },
          },
        });
      } else if (ep.link_embed) {
        // fallback: link embed (trang nhúng, không phải stream trực tiếp)
        streams.push({
          name: `OPhim`,
          title: `${server.server_name || "Server"} - Embed`,
          externalUrl: ep.link_embed,
        });
      }
    }

    return { streams };
  } catch (err) {
    console.error("stream error:", err.message);
    return { streams: [] };
  }
});

module.exports = builder;
