// upstream.ts - geo + ip-api flags for a queried IP, with edge caching.

export interface IpInfo {
  status: string;
  country: string;
  regionName: string;
  city: string;
  isp: string;
  org: string;
  as: string;
  proxy: boolean;
  hosting: boolean;
}

// minimal context shape to avoid ExecutionContext generic mismatches
interface Waitable {
  waitUntil(promise: Promise<unknown>): void;
}

const IP_API_FIELDS = "status,country,regionName,city,isp,org,as,proxy,hosting";
const CACHE_TTL_S = 6 * 60 * 60; // 6 hours

function emptyInfo(): IpInfo {
  return { status: "fail", country: "", regionName: "", city: "", isp: "", org: "", as: "", proxy: false, hosting: false };
}

function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

export async function lookupIpInfo(ip: string, ctx: Waitable): Promise<IpInfo> {
  const cache = edgeCache();
  const cacheKey = new Request(`https://tribes-proxy-check.internal/ipinfo/${ip}`);

  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return (await cached.json()) as IpInfo;
    } catch {
      // fall through to live fetch
    }
  }

  let info = emptyInfo();
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IP_API_FIELDS}`);
    if (res.ok) {
      const data = (await res.json()) as Partial<IpInfo>;
      if (data.status === "success") {
        info = {
          status: "success",
          country: data.country ?? "",
          regionName: data.regionName ?? "",
          city: data.city ?? "",
          isp: data.isp ?? "",
          org: data.org ?? "",
          as: data.as ?? "",
          proxy: data.proxy === true,
          hosting: data.hosting === true,
        };
      }
    }
  } catch {
    // upstream failure -> emptyInfo
  }

  const cacheRes = new Response(JSON.stringify(info), {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${CACHE_TTL_S}` },
  });
  ctx.waitUntil(cache.put(cacheKey, cacheRes));
  return info;
}
