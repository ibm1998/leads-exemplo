import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { N8nClient, WorkflowDefinition } from '../n8n-client';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('N8nClient', () => {
  let n8nClient: N8nClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      defaults: {
        headers: {
          common: {},
        },
      },
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);

    // Create N8nClient instance
    n8nClient = new N8nClient({
      baseUrl: 'http://localhost:5678',
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5678',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set API key in headers', () => {
      expect(mockAxiosInstance.defaults.headers.common['X-N8N-API-KEY']).toBe(
        'test-api-key'
      );
    });

    it('should setup interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('getWorkflows', () => {
    it('should fetch all workflows', async () => {
      const mockWorkflows = [
        { id: '1', name: 'Test Workflow 1', active: true },
        { id: '2', name: 'Test Workflow 2', active: false },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockWorkflows },
      });

      const result = await n8nClient.getWorkflows();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/workflows');
      expect(result).toEqual(mockWorkflows);
    });

    it('should handle response without data wrapper', async () => {
      const mockWorkflows = [
        { id: '1', name: 'Test Workflow 1', active: true },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: mockWorkflows,
      });

      const result = await n8nClient.getWorkflows();

      expect(result).toEqual(mockWorkflows);
    });

    it('should throw error on failure', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(n8nClient.getWorkflows()).rejects.toThrow(
        'Failed to get workflows: Network error'
      );
    });
  });

  describe('getWorkflow', () => {
    it('should fetch workflow by ID', async () => {
      const mockWorkflow = { id: '1', name: 'Test Workflow', active: true };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockWorkflow },
      });

      const result = await n8nClient.getWorkflow('1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/workflows/1');
      expect(result).toEqual(mockWorkflow);
    });
  });

  describe('createWorkflow', () => {
    it('should create new workflow', async () => {
      const workflowData: Omit<WorkflowDefinition, 'id'> = {
        name: 'New Workflow',
        active: true,
        nodes: [],
        connections: {},
      };

      const createdWorkflow = { id: 'new-id', ...workflowData };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: createdWorkflow },
      });

      const result = await n8nClient.createWorkflow(workflowData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/workflows',
        workflowData
      );
      expect(result).toEqual(createdWorkflow);
    });
  });

  describe('updateWorkflow', () => {
    it('should update existing workflow', async () => {
      const updates = { name: 'Updated Workflow' };
      const updatedWorkflow = {
        id: '1',
        name: 'Updated Workflow',
        active: true,
      };

      mockAxiosInstance.patch.mockResolvedValue({
        data: { data: updatedWorkflow },
      });

      const result = await n8nClient.updateWorkflow('1', updates);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/workflows/1',
        updates
      );
      expect(result).toEqual(updatedWorkflow);
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete workflow', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      await n8nClient.deleteWorkflow('1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/workflows/1');
    });
  });

  describe('activateWorkflow', () => {
    it('should activate workflow', async () => {
      mockAxiosInstance.patch.mockResolvedValue({});

      await n8nClient.activateWorkflow('1');

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/workflows/1/activate'
      );
    });
  });

  describe('deactivateWorkflow', () => {
    it('should deactivate workflow', async () => {
      mockAxiosInstance.patch.mockResolvedValue({});

      await n8nClient.deactivateWorkflow('1');

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/workflows/1/deactivate'
      );
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow manually', async () => {
      const executionData = {
        id: 'exec-1',
        finished: true,
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        data: { result: 'success' },
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: executionData },
      });

      const result = await n8nClient.executeWorkflow('1', { test: 'data' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/workflows/1/execute',
        {
          data: { test: 'data' },
        }
      );

      expect(result).toEqual({
        id: 'exec-1',
        workflowId: '1',
        status: 'success',
        startedAt: new Date('2023-01-01T00:00:00Z'),
        finishedAt: new Date('2023-01-01T00:01:00Z'),
        data: { result: 'success' },
        error: undefined,
      });
    });

    it('should handle running execution', async () => {
      const executionData = {
        id: 'exec-1',
        finished: false,
        startedAt: '2023-01-01T00:00:00Z',
        data: { result: 'running' },
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: executionData },
      });

      const result = await n8nClient.executeWorkflow('1');

      expect(result.status).toBe('running');
      expect(result.finishedAt).toBeUndefined();
    });
  });

  describe('getWorkflowExecutions', () => {
    it('should fetch workflow executions', async () => {
      const mockExecutions = [
        {
          id: 'exec-1',
          workflowId: '1',
          finished: true,
          startedAt: '2023-01-01T00:00:00Z',
          stoppedAt: '2023-01-01T00:01:00Z',
        },
        {
          id: 'exec-2',
          workflowId: '1',
          finished: false,
          startedAt: '2023-01-01T00:02:00Z',
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockExecutions },
      });

      const result = await n8nClient.getWorkflowExecutions('1', 10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/executions', {
        params: {
          filter: JSON.stringify({ workflowId: '1' }),
          limit: 10,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('success');
      expect(result[1].status).toBe('running');
    });
  });

  describe('getExecution', () => {
    it('should fetch execution by ID', async () => {
      const mockExecution = {
        id: 'exec-1',
        workflowId: '1',
        finished: true,
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        error: null,
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockExecution },
      });

      const result = await n8nClient.getExecution('exec-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/executions/exec-1');
      expect(result.id).toBe('exec-1');
      expect(result.status).toBe('success');
    });

    it('should handle execution with error', async () => {
      const mockExecution = {
        id: 'exec-1',
        workflowId: '1',
        finished: true,
        startedAt: '2023-01-01T00:00:00Z',
        stoppedAt: '2023-01-01T00:01:00Z',
        error: 'Execution failed',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockExecution },
      });

      const result = await n8nClient.getExecution('exec-1');

      expect(result.status).toBe('error');
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('stopExecution', () => {
    it('should stop workflow execution', async () => {
      mockAxiosInstance.post.mockResolvedValue({});

      await n8nClient.stopExecution('exec-1');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/executions/exec-1/stop'
      );
    });
  });

  describe('getWorkflowStats', () => {
    it('should calculate workflow statistics', async () => {
      const mockExecutions = [
        {
          id: 'exec-1',
          status: 'success',
          startedAt: new Date('2023-01-01T00:00:00Z'),
          finishedAt: new Date('2023-01-01T00:01:00Z'),
        },
        {
          id: 'exec-2',
          status: 'error',
          startedAt: new Date('2023-01-01T00:02:00Z'),
          finishedAt: new Date('2023-01-01T00:03:00Z'),
        },
        {
          id: 'exec-3',
          status: 'success',
          startedAt: new Date('2023-01-01T00:04:00Z'),
          finishedAt: new Date('2023-01-01T00:05:00Z'),
        },
      ];

      // Mock getWorkflowExecutions
      vi.spyOn(n8nClient, 'getWorkflowExecutions').mockResolvedValue(
        mockExecutions as any
      );

      const result = await n8nClient.getWorkflowStats('1');

      expect(result.totalExecutions).toBe(3);
      expect(result.successfulExecutions).toBe(2);
      expect(result.failedExecutions).toBe(1);
      expect(result.averageExecutionTime).toBe(60000); // 1 minute
      expect(result.lastExecution).toEqual(new Date('2023-01-01T00:00:00Z'));
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy n8n instance', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const result = await n8nClient.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/healthz');
      expect(result).toBe(true);
    });

    it('should return false for unhealthy n8n instance', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await n8nClient.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('authentication', () => {
    it('should use basic auth when username and password provided', () => {
      const client = new N8nClient({
        baseUrl: 'http://localhost:5678',
        username: 'admin',
        password: 'password',
      });

      const expectedAuth = Buffer.from('admin:password').toString('base64');
      expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe(
        `Basic ${expectedAuth}`
      );
    });

    it('should prefer API key over basic auth', () => {
      const client = new N8nClient({
        baseUrl: 'http://localhost:5678',
        apiKey: 'test-key',
        username: 'admin',
        password: 'password',
      });

      expect(mockAxiosInstance.defaults.headers.common['X-N8N-API-KEY']).toBe(
        'test-key'
      );
      expect(
        mockAxiosInstance.defaults.headers.common['Authorization']
      ).toBeUndefined();
    });
  });

  describe('retry logic', () => {
    it('should retry failed requests', async () => {
      // Test the retry logic by checking if shouldRetry works correctly
      const retryableError = { code: 'ECONNRESET' };
      const nonRetryableError = { response: { status: 400 } };

      // Access the private shouldRetry method through the instance
      const shouldRetryRetryable = (n8nClient as any).shouldRetry(
        retryableError
      );
      const shouldRetryNonRetryable = (n8nClient as any).shouldRetry(
        nonRetryableError
      );

      expect(shouldRetryRetryable).toBe(true);
      expect(shouldRetryNonRetryable).toBe(false);
    });

    it('should not retry non-retryable errors', async () => {
      const error = {
        response: { status: 400 },
        config: {},
      };

      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(n8nClient.getWorkflows()).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });
});
