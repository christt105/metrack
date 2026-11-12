/** One Worker, bucket or database and how much of a quota it used. */
export interface UsageConsumer {
  name: string;
  value: number;
}
