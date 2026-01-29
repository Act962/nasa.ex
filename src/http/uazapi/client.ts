import "dotenv/config";
const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL!;

interface RequestOptions extends RequestInit {
  body?: any;
}

export async function uazapiFetch<T>(
  path: string,
  options: RequestOptions & {
    token?: string;
    isAdmin?: boolean;
    baseUrl?: string;
  } = {},
): Promise<T> {
  const { token, isAdmin, baseUrl, ...fetchOptions } = options;
  const finalBaseUrl = baseUrl || UAZAPI_BASE_URL;
  const url = `${finalBaseUrl}${path}`;

  const defaultHeaders: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token && (isAdmin ? { admintoken: token } : { token: token })),
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...defaultHeaders,
      ...fetchOptions.headers,
    },
    body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `UAZAPI error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
