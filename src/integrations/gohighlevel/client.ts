// src/integration/gohighlevel/client.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RateLimiterMemory } from 'rate-limiter-flexible';

type RateLimiterRes = {
  remainingPoints: number;
  msBeforeNext: number;
  consumedPoints?: number;
};
import { logger } from '../../utils/logger';

export interface GoHighLevelConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  points: number;   // number of requests
  duration: number; // per duration in seconds
}

interface RetryAxiosConfig extends AxiosRequestConfig {
  __retryCount?: number;
}

export interface RateLimitStatus {
  remainingPoints: number;
  resetTime: Date;
}

/**
 * HTTP client for GoHighLevel REST API with built-in
 * rate limiting, retries, and logging.
 */
export class GoHighLevelClient {
  private client: AxiosInstance;
  private rateLimitInfo = {
    remainingPoints: 100,
    resetTime: new Date(Date.now() + 60 * 1000)
  };

  getRateLimitStatus(): { remaining: number; resetTime: Date } {
    const { remainingPoints, resetTime } = this.rateLimitInfo;
    return { remaining: remainingPoints, resetTime: new Date(resetTime) };
  }
  private rateLimiter: RateLimiterMemory;
  private readonly config: Required<GoHighLevelConfig>;

  constructor(config: GoHighLevelConfig) {
    this.config = {
      baseUrl: 'https://rest.gohighlevel.com/v1',
      timeout: 30_000,
      maxRetries: 3,
      rateLimit: { points: 100, duration: 60 },
      ...config,
    };

    // initialize in‐memory rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: this.config.rateLimit.points,
      duration: this.config.rateLimit.duration,
    });

    // create Axios instance
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Configure Axios request/response interceptors
   * for rate-limiting, logging, and retries.
   */
  private setupInterceptors(): void {
    // rate-limit on each request
    this.client.interceptors.request.use(
      async (reqConfig) => {
        try {
          await this.rateLimiter.consume('ghl-api');
          logger.debug('GHL rate-limit check passed');
          return reqConfig;
        } catch (rlRes: any) {
          const delay = (rlRes as RateLimiterRes).msBeforeNext || 1_000;
          logger.warn(`Rate limit exceeded, delaying ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          return reqConfig;
        }
      },
      (error) => Promise.reject(error)
    );

    // log responses and retry on 5xx
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `GHL ${response.status} ${response.config.method?.toUpperCase()} ${
            response.config.url
          }`
        );
        return response;
      },
      async (error) => {
        const cfg = error.config as RetryAxiosConfig;
        cfg.__retryCount = (cfg.__retryCount || 0) + 1;

        // give up after maxRetries
        if (
          !cfg ||
          cfg.__retryCount > this.config.maxRetries ||
          (error.response && error.response.status < 500)
        ) {
          logger.error('GHL request failed', {
            url: cfg.url,
            method: cfg.method,
            status: error.response?.status,
            message: error.message,
          });
          return Promise.reject(error);
        }

        // exponential backoff
        const backoff = 2 ** (cfg.__retryCount - 1) * 1_000;
        logger.warn(
          `Retrying GHL request in ${backoff}ms (attempt ${cfg.__retryCount}/${this.config.maxRetries})`
        );
        await new Promise((r) => setTimeout(r, backoff));
        return this.client(cfg);
      }
    );
  }

  /**
   * Perform GET request.
   */
  async get<T = any>(
    path: string,
    cfg?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(path, cfg);
  }

  /**
   * Perform POST request.
   */
  async post<T = any>(
    path: string,
    data?: any,
    cfg?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(path, data, cfg);
  }

  /**
   * Perform PUT request.
   */
  async put<T = any>(
    path: string,
    data?: any,
    cfg?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(path, data, cfg);
  }

  /**
   * Perform PATCH request.
   */
  async patch<T = any>(
    path: string,
    data?: any,
    cfg?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(path, data, cfg);
  }

  /**
   * Perform DELETE request.
   */
  async delete<T = any>(
    path: string,
    cfg?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(path, cfg);
  }

  /**
   * Ping the GoHighLevel `/ping` endpoint to verify health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/ping');
      return true;
    } catch (err) {
      logger.error('GHL health check failed', err as Error);
      return false;
    }
  }

  /**
   * Returns current rate-limit consumption state.
   */

  /**
   * Update the API key at runtime.
   */
  setApiKey(key: string): void {
    this.config.apiKey = key;
    this.client.defaults.headers.Authorization = `Bearer ${key}`;
    logger.info('GHL API key rotated');
  }

  /**
   * Reconfigure rate-limiting parameters.
   */
  setRateLimit(config: RateLimitConfig): void {
    this.rateLimiter = new RateLimiterMemory({
      points: config.points,
      duration: config.duration,
    });
    logger.info(`GHL rate limit set to ${config.points}/${config.duration}s`);
  }
}
