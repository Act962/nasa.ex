import "server-only";

// Cliente REST mínimo do Gmail (spec 0018, D-2). `fetch` puro em vez de
// `googleapis`: são três endpoints e o pacote pesa no bundle do Turbopack.

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_TIMEOUT_MS = 20_000;

export class GmailApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GmailApiError";
    this.status = status;
  }
}

export async function gmailFetch<ResponseBody>(
  path: string,
  options: {
    accessToken: string;
    searchParams?: Record<string, string | number | undefined>;
  },
): Promise<ResponseBody> {
  const url = new URL(`${GMAIL_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.accessToken}`,
    },
    signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new GmailApiError(
      `Gmail API ${response.status}: ${responseText.slice(0, 300)}`,
      response.status,
    );
  }

  return (await response.json()) as ResponseBody;
}
