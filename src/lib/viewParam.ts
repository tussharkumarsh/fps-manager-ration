/**
 * Adds an admin's ?viewFpsId= (the dealer being viewed) to an API path, with
 * the right separator; returns the path unchanged when no dealer is viewed.
 */
export function withView(path: string, viewFpsId: string | null | undefined): string {
  if (!viewFpsId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}viewFpsId=${encodeURIComponent(viewFpsId)}`;
}
