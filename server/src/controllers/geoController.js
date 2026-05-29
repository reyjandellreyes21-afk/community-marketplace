import { config } from "../config/config.js";
import { nominatimReverse, nominatimSearch } from "../lib/nominatim.js";

const TILE_CACHE_MAX = 512;
const tileCache = new Map();

function parseTileCoord(raw, name) {
  const s = String(raw ?? "").trim();
  const n = Number(s.endsWith(".png") ? s.slice(0, -4) : s);
  if (!Number.isInteger(n) || n < 0) {
    const err = new Error(`Invalid tile ${name}`);
    err.status = 400;
    throw err;
  }
  return n;
}

export const geoSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = req.query.limit != null ? Number(req.query.limit) : 5;
    const results = await nominatimSearch(q, { limit });
    res.json({ results });
  } catch (e) {
    next(e);
  }
};

export const geoReverse = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const result = await nominatimReverse(lat, lng);
    res.json({ result });
  } catch (e) {
    next(e);
  }
};

/** Proxy OSM raster tiles same-origin (avoids adblock / Tailwind img conflicts in the client). */
export const geoTile = async (req, res, next) => {
  try {
    const z = parseTileCoord(req.params.z, "z");
    const x = parseTileCoord(req.params.x, "x");
    const y = parseTileCoord(req.params.y, "y");
    if (z > 19) {
      return res.status(400).json({ error: { message: "Zoom level out of range." } });
    }

    const key = `${z}/${x}/${y}`;
    const cached = tileCache.get(key);
    if (cached) {
      res.set("Cache-Control", "public, max-age=86400, immutable");
      res.type("png");
      return res.send(cached);
    }

    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const resp = await fetch(url, {
      headers: { "User-Agent": config.nominatimUserAgent },
    });
    if (!resp.ok) {
      return res.status(resp.status === 404 ? 404 : 502).end();
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (tileCache.size >= TILE_CACHE_MAX) {
      const oldest = tileCache.keys().next().value;
      if (oldest != null) tileCache.delete(oldest);
    }
    tileCache.set(key, buf);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("png");
    res.send(buf);
  } catch (e) {
    if (e.status === 400) {
      return res.status(400).json({ error: { message: e.message } });
    }
    next(e);
  }
};
