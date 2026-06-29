type ParamsLike = { toString: () => string };

export function withSearchParams(pathname: string, params: ParamsLike): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
