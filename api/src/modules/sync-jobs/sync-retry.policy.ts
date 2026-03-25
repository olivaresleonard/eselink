import { Injectable } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';

@Injectable()
export class SyncRetryPolicy {
  readonly defaultAttempts = 5;
  readonly defaultBackoffDelayMs = 2_000;

  resolveAttempts(requestedAttempts?: number) {
    if (!requestedAttempts || requestedAttempts < 1) {
      return this.defaultAttempts;
    }

    return requestedAttempts;
  }

  buildQueueOptions(requestedAttempts?: number, priority?: number): JobsOptions {
    return {
      attempts: this.resolveAttempts(requestedAttempts),
      priority,
      removeOnComplete: 500,
      removeOnFail: 1000,
      backoff: {
        type: 'exponential',
        delay: this.defaultBackoffDelayMs,
      },
    };
  }

  isFinalAttempt(attemptsMade: number, configuredAttempts?: number) {
    return attemptsMade >= this.resolveAttempts(configuredAttempts);
  }
}
