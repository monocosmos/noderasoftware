export const hotelRouteSlugs = [
  ["hotel"],
  ["hotel", "login"],
  ["hotel", "dashboard"],
  ["hotel", "jobs"],
  ["hotel", "jobs", "new"],
  ["hotel", "jobs", "detail"],
  ["hotel", "maintenance"],
  ["hotel", "housekeeping"],
  ["hotel", "calendar", "department"],
  ["hotel", "calendar", "technical"],
  ["hotel", "calendar", "housekeeping"],
  ["hotel", "reminders"],
  ["hotel", "notifications"],
  ["hotel", "shift-panels"],
  ["hotel", "modules", "inventory"],
  ["hotel", "modules", "rooms"],
  ["hotel", "modules", "lost-found"],
  ["hotel", "modules", "guest-requests"],
  ["hotel", "modules", "requests"],
  ["hotel", "modules", "operation-documents"],
  ["hotel", "modules", "training"],
  ["hotel", "modules", "minibar"],
  ["hotel", "modules", "equipment"],
  ["hotel", "modules", "announcements"],
  ["hotel", "modules", "vip"],
  ["hotel", "hotel-floor-planning"],
  ["hotel", "reports"],
  ["hotel", "users"],
  ["hotel", "hotelpanel"],
  ["hotel", "settings"]
] as const;

export const legacyHotelRouteSlugs = [
  ["login"],
  ["dashboard"],
  ["jobs"],
  ["jobs", "new"],
  ["jobs", "detail"],
  ["maintenance"],
  ["housekeeping"],
  ["calendar", "department"],
  ["calendar", "technical"],
  ["calendar", "housekeeping"],
  ["reminders"],
  ["notifications"],
  ["shift-panels"],
  ["modules", "inventory"],
  ["modules", "rooms"],
  ["modules", "lost-found"],
  ["modules", "guest-requests"],
  ["modules", "requests"],
  ["modules", "operation-documents"],
  ["modules", "training"],
  ["modules", "minibar"],
  ["modules", "equipment"],
  ["modules", "announcements"],
  ["modules", "vip"],
  ["hotel-floor-planning"],
  ["reports"],
  ["users"],
  ["hotelpanel"],
  ["settings"]
] as const;

type RouteSlug = readonly string[];

function sameSlug(left: RouteSlug, right: RouteSlug) {
  return left.length === right.length && left.every((part, index) => part === right[index]);
}

function routePath(slug: RouteSlug) {
  return `/${slug.join("/")}`;
}

function cleanPath(path: string) {
  const withoutHash = path.split("#")[0] || "/";
  const pathname = withoutHash.split("?")[0] || "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

const hotelAppPathSet = new Set(
  hotelRouteSlugs.map((slug) => {
    const appSlug = slug.slice(1);
    return appSlug.length ? routePath(appSlug) : "/";
  })
);

export function normalizeHotelAppPath(fullPath: string) {
  let normalizedPath = cleanPath(fullPath);

  if (normalizedPath === "/hotel") {
    normalizedPath = "/";
  } else if (normalizedPath.startsWith("/hotel/")) {
    normalizedPath = normalizedPath.slice("/hotel".length) || "/";
  }

  const query = fullPath.includes("?") ? fullPath.slice(fullPath.indexOf("?")).split("#")[0] : "";
  return `${normalizedPath}${query}`;
}

export function isKnownHotelAppPath(path: string) {
  return hotelAppPathSet.has(cleanPath(normalizeHotelAppPath(path)));
}

export function isKnownHotelRouteSlug(slug: RouteSlug) {
  return hotelRouteSlugs.some((route) => sameSlug(route, slug));
}

export function isKnownLegacyHotelRouteSlug(slug: RouteSlug) {
  return legacyHotelRouteSlugs.some((route) => sameSlug(route, slug));
}
