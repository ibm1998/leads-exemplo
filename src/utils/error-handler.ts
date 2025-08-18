import { logger } from './logger';
import { config } from '../config/environment';

/**
 * Error severity levels for classification
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  SYSTEM = 'system',
  INTEGRATION = 'integration',
  DATA = 'data',
  BUSINESS_LOGIC = 'business_logic',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  VALIDATION = 'validation',
}

/**
 * Recovery strategies for different error types
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  ESCALATE = 'escalate',
  IGNORE = 'ignore',
  CIRCUIT_BREAKER = 'circuit_breaker',
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  severity: ErrorSeverity;
  category: ErrorCategory;
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  escalationRequired: boolean;
  maxRetries: number;
  backoffMultiplier: number;
  circuitBreakerThreshold?: number;
}

/**
 * Error context for detailed logging and analysis
 */
export interface ErrorContext {
  operation: string;
  component: string;
  leadId?: string;
  agentId?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  stackTrace?: string;
}

/**
 * Recovery attempt result
 */
export interface RecoveryAttempt {
  strategy: RecoveryStrategy;
  success: boolean;
  attemptNumber: number;
  duration: number;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Escalation details for human intervention
 */
export interface EscalationDetails {
  errorId: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  recoveryAttempts: RecoveryAttempt[];
  escalationReason: string;
  suggestedActions: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime?: Date;
}

/**
 * Comprehensive error handler with classification, recovery, and escalation
 */
export class ErrorHandler {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private escalationCallbacks: Array<
    (details: EscalationDetails) => Promise<void>
  > = [];

  /**
   * Classify error based on type, message, and context
   */
  classifyError(error: Error, context: ErrorContext): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Database and data errors (check before network to avoid conflicts)
    if (
      errorMessage.includes('database') ||
      errorMessage.includes('sql') ||
      errorMessage.includes('connection pool') ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('pool exhausted') ||
      errorName.includes('databaseerror')
    ) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.DATA,
        recoveryStrategy: RecoveryStrategy.RETRY,
        retryable: true,
        escalationRequired: true,
        maxRetries: 3,
        backoffMultiplier: 2,
        circuitBreakerThreshold: 5,
      };
    }

    // Network and connectivity errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorName.includes('networkerror')
    ) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NETWORK,
        recoveryStrategy: RecoveryStrategy.RETRY,
        retryable: true,
        escalationRequired: false,
        maxRetries: 5,
        backoffMultiplier: 2,
        circuitBreakerThreshold: 10,
      };
    }

    // Rate limiting errors
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429') ||
      errorMessage.includes('quota exceeded')
    ) {
      return {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.RATE_LIMIT,
        recoveryStrategy: RecoveryStrategy.RETRY,
        retryable: true,
        escalationRequired: false,
        maxRetries: 3,
        backoffMultiplier: 3,
      };
    }

    // Authentication errors
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('invalid token') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403')
    ) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.AUTHENTICATION,
        recoveryStrategy: RecoveryStrategy.ESCALATE,
        retryable: false,
        escalationRequired: true,
        maxRetries: 0,
        backoffMultiplier: 1,
      };
    }

    // Data validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('schema') ||
      errorName.includes('validationerror')
    ) {
      return {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VALIDATION,
        recoveryStrategy: RecoveryStrategy.FALLBACK,
        retryable: false,
        escalationRequired: false,
        maxRetries: 0,
        backoffMultiplier: 1,
      };
    }

    // Integration errors (external APIs)
    if (
      context.component.includes('integration') ||
      context.component.includes('api') ||
      context.component.includes('client') ||
      errorMessage.includes('api') ||
      errorMessage.includes('service unavailable')
    ) {
      return {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.INTEGRATION,
        recoveryStrategy: RecoveryStrategy.CIRCUIT_BREAKER,
        retryable: true,
        escalationRequired: false,
        maxRetries: 4,
        backoffMultiplier: 2,
        circuitBreakerThreshold: 8,
      };
    }

    // System errors (memory, disk, etc.)
    if (
      errorMessage.includes('out of memory') ||
      errorMessage.includes('disk space') ||
      errorMessage.includes('system') ||
      errorName.includes('systemerror')
    ) {
      return {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM,
        recoveryStrategy: RecoveryStrategy.ESCALATE,
        retryable: false,
        escalationRequired: true,
        maxRetries: 0,
        backoffMultiplier: 1,
      };
    }

    // Default classification for unknown errors
    return {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.BUSINESS_LOGIC,
      recoveryStrategy: RecoveryStrategy.FALLBACK,
      retryable: false,
      escalationRequired: false,
      maxRetries: 1,
      backoffMultiplier: 2,
    };
  }

  /**
   * Handle error with automatic recovery and escalation
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    fallbackFunction?: () => Promise<any>
  ): Promise<{ success: boolean; result?: any; escalated: boolean }> {
    const errorId = this.generateErrorId();
    const classification = this.classifyError(error, context);
    const recoveryAttempts: RecoveryAttempt[] = [];

    // Log the initial error
    this.logError(error, context, classification, errorId);

    // Track error frequency
    this.trackErrorFrequency(context.component, classification.category);

    try {
      // Apply recovery strategy
      const recoveryResult = await this.applyRecoveryStrategy(
        error,
        context,
        classification,
        fallbackFunction,
        recoveryAttempts
      );

      if (recoveryResult.success) {
        logger.info('Error recovery successful', {
          errorId,
          component: context.component,
          operation: context.operation,
          strategy: classification.recoveryStrategy,
          attempts: recoveryAttempts.length,
        });
        return {
          success: true,
          result: recoveryResult.result,
          escalated: false,
        };
      }

      // If recovery failed and escalation is required
      if (
        classification.escalationRequired ||
        this.shouldEscalate(context, classification)
      ) {
        await this.escalateError(
          error,
          context,
          classification,
          recoveryAttempts,
          errorId
        );
        return { success: false, escalated: true };
      }

      return { success: false, escalated: false };
    } catch (recoveryError) {
      logger.error('Error during recovery process', {
        errorId,
        originalError: error.message,
        recoveryError:
          recoveryError instanceof Error
            ? recoveryError.message
            : recoveryError,
        context,
      });

      // Escalate if recovery process itself fails
      await this.escalateError(
        error,
        context,
        classification,
        recoveryAttempts,
        errorId
      );
      return { success: false, escalated: true };
    }
  }

  /**
   * Apply recovery strategy based on error classification
   */
  private async applyRecoveryStrategy(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification,
    fallbackFunction?: () => Promise<any>,
    recoveryAttempts: RecoveryAttempt[] = []
  ): Promise<{ success: boolean; result?: any }> {
    switch (classification.recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        return await this.retryWithBackoff(
          error,
          context,
          classification,
          recoveryAttempts
        );

      case RecoveryStrategy.CIRCUIT_BREAKER:
        return await this.applyCircuitBreaker(
          error,
          context,
          classification,
          recoveryAttempts
        );

      case RecoveryStrategy.FALLBACK:
        return await this.applyFallback(
          error,
          context,
          fallbackFunction,
          recoveryAttempts
        );

      case RecoveryStrategy.ESCALATE:
        return { success: false };

      case RecoveryStrategy.IGNORE:
        logger.warn('Error ignored based on classification', {
          error: error.message,
          context,
        });
        return { success: true };

      default:
        return { success: false };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithBackoff(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification,
    recoveryAttempts: RecoveryAttempt[]
  ): Promise<{ success: boolean; result?: any }> {
    for (let attempt = 1; attempt <= classification.maxRetries; attempt++) {
      const backoffDelay = this.calculateBackoffDelay(
        attempt,
        classification.backoffMultiplier
      );

      logger.info('Retrying operation', {
        component: context.component,
        operation: context.operation,
        attempt,
        maxRetries: classification.maxRetries,
        backoffDelay,
      });

      await this.sleep(backoffDelay);

      const attemptStart = Date.now();
      try {
        // This would need to be implemented by the calling code
        // For now, we'll simulate a retry attempt
        const result = await this.simulateRetry(context);

        const duration = Date.now() - attemptStart;
        recoveryAttempts.push({
          strategy: RecoveryStrategy.RETRY,
          success: true,
          attemptNumber: attempt,
          duration,
        });

        return { success: true, result };
      } catch (retryError) {
        const duration = Date.now() - attemptStart;
        recoveryAttempts.push({
          strategy: RecoveryStrategy.RETRY,
          success: false,
          attemptNumber: attempt,
          duration,
          error:
            retryError instanceof Error
              ? retryError
              : new Error(String(retryError)),
        });

        if (attempt === classification.maxRetries) {
          logger.error('All retry attempts failed', {
            component: context.component,
            operation: context.operation,
            attempts: attempt,
            lastError:
              retryError instanceof Error ? retryError.message : retryError,
          });
        }
      }
    }

    return { success: false };
  }

  /**
   * Apply circuit breaker pattern
   */
  private async applyCircuitBreaker(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification,
    recoveryAttempts: RecoveryAttempt[]
  ): Promise<{ success: boolean; result?: any }> {
    const circuitKey = `${context.component}:${context.operation}`;
    const circuitState = this.circuitBreakers.get(circuitKey) || {
      failures: 0,
      lastFailureTime: new Date(),
      state: 'closed',
    };

    // Check circuit breaker state
    if (circuitState.state === 'open') {
      const timeSinceLastFailure =
        Date.now() - circuitState.lastFailureTime.getTime();
      const cooldownPeriod = 60000; // 1 minute cooldown

      if (timeSinceLastFailure < cooldownPeriod) {
        logger.warn('Circuit breaker is open, rejecting request', {
          component: context.component,
          operation: context.operation,
          timeSinceLastFailure,
          cooldownPeriod,
        });

        recoveryAttempts.push({
          strategy: RecoveryStrategy.CIRCUIT_BREAKER,
          success: false,
          attemptNumber: 1,
          duration: 0,
          metadata: { circuitState: 'open', reason: 'cooldown_period' },
        });

        return { success: false };
      } else {
        // Move to half-open state
        circuitState.state = 'half-open';
        this.circuitBreakers.set(circuitKey, circuitState);
      }
    }

    // Attempt the operation
    const attemptStart = Date.now();
    try {
      const result = await this.simulateRetry(context);
      const duration = Date.now() - attemptStart;

      // Success - reset circuit breaker
      circuitState.failures = 0;
      circuitState.state = 'closed';
      this.circuitBreakers.set(circuitKey, circuitState);

      recoveryAttempts.push({
        strategy: RecoveryStrategy.CIRCUIT_BREAKER,
        success: true,
        attemptNumber: 1,
        duration,
        metadata: { circuitState: 'closed' },
      });

      return { success: true, result };
    } catch (circuitError) {
      const duration = Date.now() - attemptStart;
      circuitState.failures++;
      circuitState.lastFailureTime = new Date();

      // Check if we should open the circuit
      if (
        classification.circuitBreakerThreshold &&
        circuitState.failures >= classification.circuitBreakerThreshold
      ) {
        circuitState.state = 'open';
        logger.warn('Circuit breaker opened due to repeated failures', {
          component: context.component,
          operation: context.operation,
          failures: circuitState.failures,
          threshold: classification.circuitBreakerThreshold,
        });
      }

      this.circuitBreakers.set(circuitKey, circuitState);

      recoveryAttempts.push({
        strategy: RecoveryStrategy.CIRCUIT_BREAKER,
        success: false,
        attemptNumber: 1,
        duration,
        error:
          circuitError instanceof Error
            ? circuitError
            : new Error(String(circuitError)),
        metadata: {
          circuitState: circuitState.state,
          failures: circuitState.failures,
        },
      });

      return { success: false };
    }
  }

  /**
   * Apply fallback strategy
   */
  private async applyFallback(
    error: Error,
    context: ErrorContext,
    fallbackFunction?: () => Promise<any>,
    recoveryAttempts: RecoveryAttempt[] = []
  ): Promise<{ success: boolean; result?: any }> {
    if (!fallbackFunction) {
      logger.warn('No fallback function provided', {
        component: context.component,
        operation: context.operation,
      });

      recoveryAttempts.push({
        strategy: RecoveryStrategy.FALLBACK,
        success: false,
        attemptNumber: 1,
        duration: 0,
        metadata: { reason: 'no_fallback_function' },
      });

      return { success: false };
    }

    const attemptStart = Date.now();
    try {
      const result = await fallbackFunction();
      const duration = Date.now() - attemptStart;

      logger.info('Fallback strategy successful', {
        component: context.component,
        operation: context.operation,
        duration,
      });

      recoveryAttempts.push({
        strategy: RecoveryStrategy.FALLBACK,
        success: true,
        attemptNumber: 1,
        duration,
      });

      return { success: true, result };
    } catch (fallbackError) {
      const duration = Date.now() - attemptStart;

      logger.error('Fallback strategy failed', {
        component: context.component,
        operation: context.operation,
        fallbackError:
          fallbackError instanceof Error
            ? fallbackError.message
            : fallbackError,
        duration,
      });

      recoveryAttempts.push({
        strategy: RecoveryStrategy.FALLBACK,
        success: false,
        attemptNumber: 1,
        duration,
        error:
          fallbackError instanceof Error
            ? fallbackError
            : new Error(String(fallbackError)),
      });

      return { success: false };
    }
  }

  /**
   * Escalate error to human intervention
   */
  private async escalateError(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification,
    recoveryAttempts: RecoveryAttempt[],
    errorId: string
  ): Promise<void> {
    const escalationDetails: EscalationDetails = {
      errorId,
      severity: classification.severity,
      category: classification.category,
      context,
      recoveryAttempts,
      escalationReason: this.getEscalationReason(
        classification,
        recoveryAttempts
      ),
      suggestedActions: this.getSuggestedActions(classification, context),
      priority: this.getEscalationPriority(classification),
    };

    logger.error('Escalating error to human intervention', {
      errorId,
      escalationDetails,
    });

    // Notify all registered escalation callbacks
    for (const callback of this.escalationCallbacks) {
      try {
        await callback(escalationDetails);
      } catch (callbackError) {
        logger.error('Error in escalation callback', {
          errorId,
          callbackError:
            callbackError instanceof Error
              ? callbackError.message
              : callbackError,
        });
      }
    }
  }

  /**
   * Register escalation callback
   */
  registerEscalationCallback(
    callback: (details: EscalationDetails) => Promise<void>
  ): void {
    this.escalationCallbacks.push(callback);
  }

  /**
   * Check if error should be escalated based on frequency and severity
   */
  private shouldEscalate(
    context: ErrorContext,
    classification: ErrorClassification
  ): boolean {
    const errorKey = `${context.component}:${classification.category}`;
    const errorCount = this.errorCounts.get(errorKey) || 0;

    // Escalate if we've seen too many errors of this type
    const escalationThresholds = {
      [ErrorSeverity.CRITICAL]: 1,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.MEDIUM]: 10,
      [ErrorSeverity.LOW]: 20,
    };

    return errorCount >= escalationThresholds[classification.severity];
  }

  /**
   * Track error frequency for escalation decisions
   */
  private trackErrorFrequency(
    component: string,
    category: ErrorCategory
  ): void {
    const errorKey = `${component}:${category}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    // Reset counts periodically (every hour)
    setTimeout(() => {
      this.errorCounts.delete(errorKey);
    }, 3600000);
  }

  /**
   * Log error with comprehensive details
   */
  private logError(
    error: Error,
    context: ErrorContext,
    classification: ErrorClassification,
    errorId: string
  ): void {
    const logData = {
      errorId,
      message: error.message,
      name: error.name,
      stack: error.stack,
      context,
      classification,
      timestamp: new Date().toISOString(),
    };

    switch (classification.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL ERROR', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('HIGH SEVERITY ERROR', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('MEDIUM SEVERITY ERROR', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('LOW SEVERITY ERROR', logData);
        break;
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoffDelay(attempt: number, multiplier: number): number {
    const baseDelay = 50; // 50ms for faster testing
    const jitter = Math.random() * 0.1; // Add 10% jitter
    return Math.floor(
      baseDelay * Math.pow(multiplier, attempt - 1) * (1 + jitter)
    );
  }

  /**
   * Sleep utility for backoff delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Simulate retry attempt (placeholder for actual retry logic)
   */
  private async simulateRetry(context: ErrorContext): Promise<any> {
    // This is a placeholder - in real implementation, this would
    // re-execute the original operation that failed
    // For testing, we'll make it fail quickly
    await new Promise((resolve) => setTimeout(resolve, 10)); // Very short delay
    throw new Error('Retry simulation - operation still failing');
  }

  /**
   * Get escalation reason based on classification and attempts
   */
  private getEscalationReason(
    classification: ErrorClassification,
    recoveryAttempts: RecoveryAttempt[]
  ): string {
    if (classification.severity === ErrorSeverity.CRITICAL) {
      return 'Critical system error requiring immediate attention';
    }

    if (classification.escalationRequired) {
      return 'Error type requires human intervention';
    }

    if (
      recoveryAttempts.length > 0 &&
      recoveryAttempts.every((a) => !a.success)
    ) {
      return 'All automatic recovery attempts failed';
    }

    return 'Error escalated due to frequency or severity threshold';
  }

  /**
   * Get suggested actions for escalation
   */
  private getSuggestedActions(
    classification: ErrorClassification,
    context: ErrorContext
  ): string[] {
    const actions: string[] = [];

    switch (classification.category) {
      case ErrorCategory.AUTHENTICATION:
        actions.push('Check API credentials and tokens');
        actions.push('Verify authentication configuration');
        break;
      case ErrorCategory.NETWORK:
        actions.push('Check network connectivity');
        actions.push('Verify external service status');
        actions.push('Review firewall and proxy settings');
        break;
      case ErrorCategory.DATA:
        actions.push('Check database connectivity');
        actions.push('Verify data integrity');
        actions.push('Review recent data changes');
        break;
      case ErrorCategory.INTEGRATION:
        actions.push('Check external API status');
        actions.push('Verify integration configuration');
        actions.push('Review API rate limits');
        break;
      case ErrorCategory.SYSTEM:
        actions.push('Check system resources (CPU, memory, disk)');
        actions.push('Review system logs');
        actions.push('Consider scaling resources');
        break;
      default:
        actions.push('Review error logs and context');
        actions.push('Check component configuration');
    }

    actions.push(`Review ${context.component} component logs`);
    actions.push(`Investigate ${context.operation} operation`);

    return actions;
  }

  /**
   * Get escalation priority based on severity
   */
  private getEscalationPriority(
    classification: ErrorClassification
  ): 'low' | 'medium' | 'high' | 'urgent' {
    switch (classification.severity) {
      case ErrorSeverity.CRITICAL:
        return 'urgent';
      case ErrorSeverity.HIGH:
        return 'high';
      case ErrorSeverity.MEDIUM:
        return 'medium';
      case ErrorSeverity.LOW:
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    circuitBreakerStates: Array<{
      key: string;
      state: string;
      failures: number;
      lastFailureTime: Date;
    }>;
  } {
    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach((category) => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach((severity) => {
      errorsBySeverity[severity] = 0;
    });

    // This would be populated from actual error tracking
    // For now, return empty statistics
    const circuitBreakerStates = Array.from(this.circuitBreakers.entries()).map(
      ([key, state]) => ({
        key,
        state: state.state,
        failures: state.failures,
        lastFailureTime: state.lastFailureTime,
      })
    );

    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      errorsByCategory,
      errorsBySeverity,
      circuitBreakerStates,
    };
  }

  /**
   * Reset circuit breaker for a specific operation
   */
  resetCircuitBreaker(component: string, operation: string): void {
    const circuitKey = `${component}:${operation}`;
    this.circuitBreakers.delete(circuitKey);
    logger.info('Circuit breaker reset', { component, operation });
  }

  /**
   * Clear all error statistics (useful for testing)
   */
  clearErrorStatistics(): void {
    this.errorCounts.clear();
    this.circuitBreakers.clear();
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
