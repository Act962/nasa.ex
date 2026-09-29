type RouteRedirect = {
  match: RegExp;
  target: string;
};

const ROUTE_REDIRECTS: RouteRedirect[] = [
  { match: /^\/workspaces\/[^/]+/, target: "/workspaces" },
  { match: /^\/tracking\/[^/]+/, target: "/tracking" },
  // Funil e conversa abertos são da empresa anterior: volta ao chat limpo.
  { match: /^\/tracking-chat/, target: "/tracking-chat" },
];

export function resolveOrgSwitchRedirect(pathname: string): string | null {
  const hit = ROUTE_REDIRECTS.find((redirect) => redirect.match.test(pathname));
  return hit ? hit.target : null;
}
