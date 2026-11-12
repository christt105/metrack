import type { UsageConsumer } from './UsageConsumer.js';

/** The measured value of one quota with every consumer, biggest first. */
export interface UsageReading {
  used: number;
  consumers: UsageConsumer[];
}
