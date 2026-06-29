/**
 * sprite-defaults.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Assigns a deterministic, unique-looking Pipoya sprite to every userId that
 * has not manually chosen a character. With 167 variants the chance two random
 * users share the same default is <1%.
 *
 * Also exports helpers used by WorldScene and SpaceGame to normalise spriteUrl
 * values (e.g. the special sentinel "pixel_astronaut").
 */

const BASE = "/woka/pipoya/";

/** All 167 Pipoya PNG files shipped in /public/woka/pipoya/ */
export const ALL_PIPOYA_SPRITES: string[] = [
  /* Female 01–25 */
  "Female 01-1","Female 01-2","Female 01-3","Female 01-4",
  "Female 02-1","Female 02-2","Female 02-3","Female 02-4",
  "Female 03-1","Female 03-2","Female 03-3","Female 03-4",
  "Female 04-1","Female 04-2","Female 04-3","Female 04-4",
  "Female 05-1","Female 05-2","Female 05-3","Female 05-4",
  "Female 06-1","Female 06-2","Female 06-3","Female 06-4",
  "Female 07-1","Female 07-2","Female 07-3","Female 07-4",
  "Female 08-1","Female 08-2","Female 08-3","Female 08-4",
  "Female 09-1","Female 09-2","Female 09-3","Female 09-4",
  "Female 10-1","Female 10-2","Female 10-3","Female 10-4",
  "Female 11-1","Female 11-2","Female 11-3","Female 11-4",
  "Female 12-1","Female 12-2","Female 12-3","Female 12-4",
  "Female 13-1","Female 13-2","Female 13-3","Female 13-4",
  "Female 14-1","Female 14-2","Female 14-3","Female 14-4",
  "Female 15-1","Female 15-2","Female 15-3","Female 15-4",
  "Female 16-1","Female 16-2","Female 16-3","Female 16-4",
  "Female 17-1","Female 17-2","Female 17-3","Female 17-4",
  "Female 18-1","Female 18-2","Female 18-3","Female 18-4",
  "Female 19-1","Female 19-2","Female 19-3","Female 19-4",
  "Female 20-1","Female 20-2","Female 20-3","Female 20-4",
  "Female 21-1","Female 21-2","Female 21-3","Female 21-4",
  "Female 22-1","Female 22-2","Female 22-3","Female 22-4",
  "Female 23-1",
  "Female 24-1",
  "Female 25-1",
  /* Male 01–25 */
  "Male 01-1","Male 01-2","Male 01-3","Male 01-4",
  "Male 02-1","Male 02-2","Male 02-3","Male 02-4",
  "Male 03-1","Male 03-2","Male 03-3","Male 03-4",
  "Male 04-1","Male 04-2","Male 04-3","Male 04-4",
  "Male 05-1","Male 05-2","Male 05-3","Male 05-4",
  "Male 06-1","Male 06-2","Male 06-3","Male 06-4",
  "Male 07-1","Male 07-2","Male 07-3","Male 07-4",
  "Male 08-1","Male 08-2","Male 08-3","Male 08-4",
  "Male 09-1","Male 09-2","Male 09-3","Male 09-4",
  "Male 10-1","Male 10-2","Male 10-3","Male 10-4",
  "Male 11-1","Male 11-2","Male 11-3","Male 11-4",
  "Male 12-1","Male 12-2","Male 12-3","Male 12-4",
  "Male 13-1","Male 13-2","Male 13-3","Male 13-4",
  "Male 14-1","Male 14-2","Male 14-3","Male 14-4",
  "Male 15-1","Male 15-2","Male 15-3","Male 15-4",
  "Male 16-1","Male 16-2","Male 16-3","Male 16-4",
  "Male 17-1","Male 17-2","Male 17-3","Male 17-4",
  "Male 18-1",
  "Male 19-1",
  "Male 20-1",
  "Male 21-1",
  "Male 22-1",
  "Male 23-1",
  "Male 24-1",
  "Male 25-1",
].map(name => `${BASE}${name}.png`);

/**
 * Returns a deterministic Pipoya sprite path for the given userId.
 * Two different userIds almost always resolve to different sprites.
 */
export function getDefaultSpriteForUser(userId: string): string {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0; // djb2 hash, unsigned
  }
  return ALL_PIPOYA_SPRITES[h % ALL_PIPOYA_SPRITES.length];
}

/**
 * Normalises a raw `lpcSpritesheetUrl` value into a URL that can be fetched
 * for the LOCAL user. "pixel_astronaut" maps to the local base PNG — the
 * caller is expected to composite the visor with the user's photo.
 */
export function resolveSpriteUrl(
  raw: string | null | undefined,
  userId: string,
): string {
  if (!raw) return getDefaultSpriteForUser(userId);
  if (raw === "pixel_astronaut") return "/lpc_pixel_astronaut.png";
  return raw;
}

/**
 * Variant of `resolveSpriteUrl` for REMOTE players.
 *
 * The "pixel_astronaut" sentinel is a composite that requires the user's own
 * photo to build a unique visor — impossible for remote players unless their
 * photo is broadcast. Without the photo, every remote pixel_astronaut would
 * render as the exact same base sprite, making all astronauts look identical.
 *
 * This helper falls back to a deterministic Pipoya sprite (derived from the
 * userId hash) so every remote player looks visually distinct.
 */
export function resolveRemoteSpriteUrl(
  raw: string | null | undefined,
  userId: string,
): string {
  if (!raw)                        return getDefaultSpriteForUser(userId);
  if (raw === "pixel_astronaut")   return getDefaultSpriteForUser(userId);
  return raw;
}
