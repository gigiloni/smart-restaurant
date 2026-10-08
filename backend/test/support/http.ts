import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * A response body nobody has typed. Tests check bodies with assertions and the
 * contract schemas, so a precise type would only add casts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface ApiResponse<T> {
  status: number;
  body: T;
  headers: Record<string, string | string[] | number | undefined>;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS';

/**
 * A small client over `app.inject()`. `cookie` makes every request come from
 * one caller: a signed-in employee, a seated guest, or both.
 */
export function api(app: NestFastifyApplication, cookie?: string) {
  const send = async <T>(
    method: Method,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse<T>> => {
    const response = await app.inject({
      method,
      url,
      payload: body as never,
      headers: { ...(cookie ? { cookie } : {}), ...headers },
    });

    let parsed: unknown = response.body;
    try {
      parsed = response.json();
    } catch {
      // Not JSON: keep the text.
    }

    return { status: response.statusCode, body: parsed as T, headers: response.headers };
  };

  return {
    get: <T = Json>(url: string, headers?: Record<string, string>) =>
      send<T>('GET', url, undefined, headers),
    post: <T = Json>(url: string, body: unknown = {}, headers?: Record<string, string>) =>
      send<T>('POST', url, body, headers),
    patch: <T = Json>(url: string, body: unknown, headers?: Record<string, string>) =>
      send<T>('PATCH', url, body, headers),
    delete: <T = Json>(url: string, headers?: Record<string, string>) =>
      send<T>('DELETE', url, undefined, headers),
    options: <T = Json>(url: string, headers?: Record<string, string>) =>
      send<T>('OPTIONS', url, undefined, headers),
  };
}

export type Api = ReturnType<typeof api>;

/** The `name=value` pairs of a response's Set-Cookie headers, ready to send back. */
export function cookiesOf(response: ApiResponse<unknown>): string {
  const header = response.headers['set-cookie'];

  return ([] as string[])
    .concat((header as string | string[] | undefined) ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
