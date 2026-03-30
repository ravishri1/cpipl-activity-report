/**
 * Circuit Breaker — Fault Tolerance for External Services
 *
 * Pattern: Circuit Breaker (Closed → Open → Half-Open state machine).
 *
 * Why it reduces load: When an external service (Google Drive, Gmail, SMTP)
 * is down, without a circuit breaker every request retries and waits for the
 * full timeout — piling up DB connections and exhausting the Node.js event
 * loop. The breaker opens after `threshold` consecutive failures and
 * immediately rejects calls for the `timeoutMs` cooldown window, preventing
 * resource exhaustion while the external service recovers.
 *
 * Self-healing mechanism:
 *   CLOSED  → normal operation, failures increment counter
 *   OPEN    → breaker trips, all calls rejected immediately with error
 *   HALF_OPEN → after `timeoutMs`, one probe call is allowed through.
 *               If it succeeds `successThreshold` times, breaker closes.
 *               If it fails, breaker reopens with a fresh timeout.
 *
 * The breaker heals itself automatically — no manual reset needed.
 * All instances share breakers via the module-level `breakers` Map, so a
 * single broken service is detected across all routes in the same process.
 */

class CircuitBreaker {
  /**
   * @param {string} name — human-readable name for the protected service
   * @param {object} options
   * @param {number} options.threshold — consecutive failures before opening (default: 5)
   * @param {number} options.timeoutMs — ms to wait in OPEN state before probing (default: 30000)
   * @param {number} options.successThreshold — successes needed in HALF_OPEN to close (default: 2)
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenSuccesses = 0;
    this.lastFailureTime = null;
    this.threshold = options.threshold ?? 5;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.successThreshold = options.successThreshold ?? 2;
  }

  /**
   * Wrap an async function call with circuit-breaker protection.
   * @param {Function} fn — () => Promise<T>
   * @returns {Promise<T>}
   * @throws if breaker is OPEN or if fn throws after recording failure
   */
  async call(fn) {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenSuccesses = 0;
      } else {
        const waitSecs = Math.ceil((this.timeoutMs - elapsed) / 1000);
        throw new Error(
          `[CircuitBreaker] ${this.name} is OPEN — service unavailable. Retrying in ${waitSecs}s.`
        );
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        console.log(`[CircuitBreaker] ${this.name} CLOSED — service recovered.`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.warn(
        `[CircuitBreaker] ${this.name} OPEN after ${this.failureCount} failure(s). ` +
        `Cooling down for ${this.timeoutMs / 1000}s.`
      );
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}

/** Module-level singleton registry — shared within the same process */
const breakers = new Map();

/**
 * Get or create a named circuit breaker.
 * @param {string} name
 * @param {object} options — passed to CircuitBreaker constructor on first call
 */
function getBreaker(name, options = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}

/**
 * Returns status of all registered breakers (used by /api/health).
 */
function getAllBreakerStatus() {
  const out = {};
  for (const [name, breaker] of breakers) {
    out[name] = breaker.getStatus();
  }
  return out;
}

// Pre-register breakers for known external services
getBreaker('google-drive', { threshold: 5, timeoutMs: 60_000 });
getBreaker('google-gmail', { threshold: 5, timeoutMs: 60_000 });
getBreaker('google-workspace', { threshold: 5, timeoutMs: 60_000 });
getBreaker('email-smtp', { threshold: 3, timeoutMs: 30_000 });
getBreaker('clerk-api', { threshold: 3, timeoutMs: 15_000 });

module.exports = { CircuitBreaker, getBreaker, getAllBreakerStatus };
