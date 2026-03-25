import {
  BadGatewayException,
  Injectable,
  HttpException,
} from '@nestjs/common';

type MercadoLibreRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  accessToken?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown> | URLSearchParams;
  contentType?: 'json' | 'form';
  retryCount?: number;
};

type MercadoLibreBinaryResponse = {
  body: Buffer;
  contentType: string | null;
  contentDisposition: string | null;
};

@Injectable()
export class MercadoLibreApiClient {
  private readonly apiBaseUrl =
    process.env.MELI_API_BASE_URL ?? 'https://api.mercadolibre.com';
  private readonly maxRetries = 5;

  async request<T>(path: string, options: MercadoLibreRequestOptions = {}): Promise<T> {
    const response = await this.performRequest(path, options);

    return (await response.json()) as T;
  }

  async requestBinary(
    path: string,
    options: MercadoLibreRequestOptions = {},
  ): Promise<MercadoLibreBinaryResponse> {
    const response = await this.performRequest(path, options);
    const arrayBuffer = await response.arrayBuffer();

    return {
      body: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  private async performRequest(
    path: string,
    options: MercadoLibreRequestOptions = {},
  ): Promise<Response> {
    // Mercado Libre serves token exchange and refresh under api.mercadolibre.com.
    const baseUrl = options.baseUrl ?? this.apiBaseUrl;
    const url = new URL(`${baseUrl}${path}`);

    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = new Headers({
      Accept: 'application/json',
    });

    if (options.accessToken) {
      headers.set('Authorization', `Bearer ${options.accessToken}`);
    }

    Object.entries(options.headers ?? {}).forEach(([key, value]) => {
      headers.set(key, value);
    });

    let body: BodyInit | undefined;

    if (options.body instanceof URLSearchParams) {
      body = options.body.toString();
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    } else if (options.body) {
      body = JSON.stringify(options.body);
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
    });

    if (response.status === 429 || response.status >= 500) {
      const retryCount = options.retryCount ?? 0;

      if (retryCount < this.maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
        const delay = retryAfter ?? 2 ** retryCount * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.performRequest(path, {
          ...options,
          retryCount: retryCount + 1,
        });
      }
    }

    if (!response.ok) {
      const text = await response.text();
      const message = text || `Mercado Libre request failed with status ${response.status}`;

      if (response.status === 429) {
        throw new HttpException(message, 429);
      }

      if (response.status >= 500) {
        throw new BadGatewayException(message);
      }

      throw new HttpException(message, response.status);
    }

    return response;
  }
}
