type RouteRedirect = {
  match: RegExp;
  target: string;
};

const ROUTE_REDIRECTS: RouteRedirect[] = [
  { match: /^\/workspaces\/[^/]+/, target: "/workspaces" },
  { match: /^\/tracking\/[^/]+/, target: "/tracking" },
];

export function resolveOrgSwitchRedirect(pathname: string): string | null {
  const hit = ROUTE_REDIRECTS.find((r) => r.match.test(pathname));
  return hit ? hit.target : null;
}
