/**
 * Simple Circuit Breaker Implementation
 * Prevents cascade failures when external services are down
 */

export class SimpleCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeMs: number;

  constructor(threshold: number = 5, resetTimeMs: number = 60000) {
    this.threshold = threshold;
    this.resetTimeMs = resetTimeMs;
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - The function to execute
   * @param serviceName - Name of the service (for logging)
   * @returns Promise with the function result
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(
    fn: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    // Check if circuit is open
    if (this.isOpen()) {
      const secondsSinceFailure = Math.round((Date.now() - this.lastFailureTime) / 1000);
      throw new Error(
        `Circuit breaker OPEN for ${serviceName} - too many failures (${this.failureCount}/${this.threshold}). ` +
        `Last failure ${secondsSinceFailure}s ago. Will reset in ${Math.ceil((this.resetTimeMs - (Date.now() - this.lastFailureTime)) / 1000)}s.`
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit breaker is open (blocking calls)
   */
  private isOpen(): boolean {
    if (this.failureCount >= this.threshold) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.resetTimeMs) {
        return true; // Circuit still open
      }
      // Reset after timeout
      this.reset();
    }
    return false;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.reset();
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.log(`[CIRCUIT BREAKER] Failure count: ${this.failureCount}/${this.threshold}`);
  }

  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    if (this.failureCount > 0) {
      console.log(`[CIRCUIT BREAKER] Reset - clearing ${this.failureCount} failures`);
    }
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Get current state for monitoring
   */
  getState(): {
    failureCount: number;
    isOpen: boolean;
    lastFailureTime: number;
  } {
    return {
      failureCount: this.failureCount,
      isOpen: this.isOpen(),
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Export singleton instance for Lead Service
export const leadServiceBreaker = new SimpleCircuitBreaker(5, 60000);

