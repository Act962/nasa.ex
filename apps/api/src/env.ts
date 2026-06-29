const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  PORT: toNumber(process.env.API_PORT, 3333),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
