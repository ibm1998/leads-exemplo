import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import axios from "axios";
import { GoHighLevelClient } from "../client";

// Mock axios
vi.mock("axios");
const mockedAxios = axios as any;

describe("GoHighLevelClient", () => {
  let client: GoHighLevelClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    client = new GoHighLevelClient({
      apiKey: "test-api-key",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create axios instance with correct configuration", () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "https://rest.gohighlevel.com/v1",
        timeout: 30000,
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
    });

    it("should use custom base URL when provided", () => {
      const customClient = new GoHighLevelClient({
        apiKey: "test-key",
        baseUrl: "https://custom.api.com",
      });

      expect(mockedAxios.create).toHaveBeenLastCalledWith({
        baseURL: "https://custom.api.com",
        timeout: 30000,
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
    });

    it("should setup request and response interceptors", () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe("HTTP methods", () => {
    it("should call axios.get with correct parameters", async () => {
      const mockResponse = { data: { id: "123" } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.get("/test", { params: { id: "123" } });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/test", {
        params: { id: "123" },
      });
      expect(result).toBe(mockResponse);
    });

    it("should call axios.post with correct parameters", async () => {
      const mockResponse = { data: { id: "123" } };
      const postData = { name: "test" };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.post("/test", postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/test",
        postData,
        undefined
      );
      expect(result).toBe(mockResponse);
    });

    it("should call axios.put with correct parameters", async () => {
      const mockResponse = { data: { id: "123" } };
      const putData = { name: "updated" };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.put("/test/123", putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/test/123",
        putData,
        undefined
      );
      expect(result).toBe(mockResponse);
    });

    it("should call axios.patch with correct parameters", async () => {
      const mockResponse = { data: { id: "123" } };
      const patchData = { name: "patched" };
      mockAxiosInstance.patch.mockResolvedValue(mockResponse);

      const result = await client.patch("/test/123", patchData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "/test/123",
        patchData,
        undefined
      );
      expect(result).toBe(mockResponse);
    });

    it("should call axios.delete with correct parameters", async () => {
      const mockResponse = { data: { success: true } };
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await client.delete("/test/123");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/test/123",
        undefined
      );
      expect(result).toBe(mockResponse);
    });
  });

  describe("healthCheck", () => {
    it("should return true when ping succeeds", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: "pong" });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/ping", undefined);
    });

    it("should return false when ping fails", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Network error"));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return rate limit status", () => {
      const status = client.getRateLimitStatus();

      expect(status).toHaveProperty("remaining");
      expect(status).toHaveProperty("resetTime");
      expect(typeof status.remaining).toBe("number");
      expect(status.resetTime).toBeInstanceOf(Date);
    });
  });
});
