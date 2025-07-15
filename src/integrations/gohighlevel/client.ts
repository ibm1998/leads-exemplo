import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { logger } from "../../utils/logger";

export interface GoHighLevelConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface RateLimitConfig {
  points: number; // Number of requests
  duration: number; // Per duration in seconds
}

export class GoHighLevelClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiterMemory;
  private config: Required<GoHighLevelConfig>;

  constructor(config: GoHighLevelConfig) {
    this.config = {
      baseUrl: "https://rest.gohighlevel.com/v1",
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };

    // GoHighLevel rate limit: 100 requests per minute
    this.rateLimiter = new RateLimiterMemory({
      points: 100,
      duration: 60, // 60 seconds
    });

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        try {
          await this.rateLimiter.consume("ghl-api");
          logger.debug("GoHighLevel API request rate limit check passed");
          return config;
        } catch (rateLimiterRes) {
          const msBeforeNext = rateLimiterRes.msBeforeNext || 1000;
          logger.warn(
            `GoHighLevel API rate limit exceeded. Waiting ${msBeforeNext}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, msBeforeNext));
          return config;
        }
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and retries
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `GoHighLevel API response: ${
            response.status
          } ${response.config.method?.toUpperCase()} ${response.config.url}`
        );
        return response;
      },
      async (error) => {
        const config = error.config;

        if (!config || config.__retryCount >= this.config.maxRetries) {
          logger.error("GoHighLevel API request failed after max retries", {
            url: config?.url,
            method: config?.method,
            status: error.response?.status,
            message: error.message,
          });
          return Promise.reject(error);
        }

        config.__retryCount = (config.__retryCount || 0) + 1;

        // Retry on 5xx errors or network errors
        if (!error.response || error.response.status >= 500) {
          const delay = Math.pow(2, config.__retryCount) * 1000; // Exponential backoff
          logger.warn(
            `GoHighLevel API request failed, retrying in ${delay}ms (attempt ${config.__retryCount}/${this.config.maxRetries})`
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.get("/ping");
      return true;
    } catch (error) {
      logger.error("GoHighLevel API health check failed", error);
      return false;
    }
  }

  // Get current rate limit status
  getRateLimitStatus(): { remaining: number; resetTime: Date } {
    const res = this.rateLimiter.get("ghl-api");
    return {
      remaining: res ? Math.max(0, 100 - res.hits) : 100,
      resetTime: new Date(Date.now() + (res?.msBeforeNext || 0)),
    };
  }
}
