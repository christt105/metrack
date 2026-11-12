import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { CloudflareUsageClient } from './CloudflareUsageClient.js';
import type { CloudflareUsageConfig } from './CloudflareUsageConfig.js';
import { formatUsageValue } from './formatUsageValue.js';
import type { UsageMetricDefinition } from './UsageMetricDefinition.js';
import { usageMetricDefinitions } from './usageMetricDefinitions.js';
import { utcDay } from './usagePeriods.js';
import type { UsageReading } from './UsageReading.js';
import type { UsageState } from './UsageState.js';
import type { UsageStateStore } from './UsageStateStore.js';

const FAILURES_BEFORE_NOTICE = 3;

/** Compares the account usage with the free-plan limits and notifies once per threshold and period. */
export class CloudflareUsageMonitor {
  private state: UsageState;
  private failures = 0;
  private readonly reportedActions = new Set<string>();

  constructor(
    private readonly client: Pick<CloudflareUsageClient, 'read'>,
    private readonly config: CloudflareUsageConfig,
    private readonly store: UsageStateStore,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.state = store.load();
  }

  /** Runs one check. Never throws. */
  async tick(): Promise<void> {
    let sample;
    try {
      sample = await this.client.read();
    } catch (error) {
      await this.recordFailure(error instanceof Error ? error.message : String(error));
      return;
    }
    this.failures = 0;
    for (const action of sample.unknownR2Actions) {
      if (this.reportedActions.has(action)) continue;
      this.reportedActions.add(action);
      this.logger.info(`cloudflare usage: unknown R2 action ${action}, counted as Class A`);
    }
    this.prune();
    for (const definition of usageMetricDefinitions) {
      const reading = sample.readings[definition.key];
      if (reading) await this.evaluate(definition, reading);
    }
    this.save();
  }

  private async evaluate(definition: UsageMetricDefinition, reading: UsageReading): Promise<void> {
    const limit = this.config.limits[definition.key];
    const percent = (reading.used / limit) * 100;
    const level =
      percent >= this.config.criticalPercent
        ? this.config.criticalPercent
        : percent >= this.config.warnPercent
          ? this.config.warnPercent
          : 0;
    const stateKey = `${definition.key}|${this.periodOf(definition)}`;
    if (level === 0 || level <= (this.state.sent[stateKey] ?? 0)) return;
    const critical = level === this.config.criticalPercent;
    const delivered = await this.notifier.notify(
      `Cloudflare usage ${Math.floor(percent)}%: ${definition.label}`,
      this.body(definition, reading, limit, percent),
      {
        priority: critical ? 'urgent' : 'default',
        tags: [critical ? 'rotating_light' : 'warning'],
      },
    );
    if (delivered) {
      this.state.sent[stateKey] = level;
      this.save();
    }
  }

  private body(
    definition: UsageMetricDefinition,
    reading: UsageReading,
    limit: number,
    percent: number,
  ): string {
    const unit = definition.unit;
    const period =
      definition.period === 'day'
        ? `today (UTC ${this.periodOf(definition)})`
        : `this month (UTC ${this.periodOf(definition)})`;
    const lines = [
      `${formatUsageValue(reading.used, unit)} of ${formatUsageValue(limit, unit)} (${percent.toFixed(1)}%) ${period}.`,
    ];
    const top = reading.consumers.filter((c) => c.value > 0).slice(0, 3);
    if (top.length > 0) {
      lines.push('Top consumers:');
      for (const c of top) {
        const value = formatUsageValue(c.value, unit);
        if (!definition.showShares) {
          lines.push(`- ${c.name}: ${value}`);
          continue;
        }
        const share = reading.used > 0 ? ((c.value / reading.used) * 100).toFixed(0) : '0';
        lines.push(`- ${c.name}: ${value} (${share}%)`);
      }
    }
    return lines.join('\n');
  }

  private async recordFailure(reason: string): Promise<void> {
    this.failures += 1;
    this.logger.error(`cloudflare usage check failed (${this.failures} in a row): ${reason}`);
    const today = utcDay(this.now());
    if (this.failures < FAILURES_BEFORE_NOTICE || this.state.failureNoticeDay === today) return;
    const delivered = await this.notifier.notify(
      'Cloudflare usage check is failing',
      `The last ${this.failures} checks failed: ${reason}`,
      { priority: 'default', tags: ['warning'] },
    );
    if (delivered) {
      this.state.failureNoticeDay = today;
      this.save();
    }
  }

  private periodOf(definition: UsageMetricDefinition): string {
    const day = utcDay(this.now());
    return definition.period === 'day' ? day : day.slice(0, 7);
  }

  private prune(): void {
    const current = new Set(usageMetricDefinitions.map((d) => `${d.key}|${this.periodOf(d)}`));
    for (const key of Object.keys(this.state.sent)) {
      if (!current.has(key)) delete this.state.sent[key];
    }
  }

  private save(): void {
    try {
      this.store.save(this.state);
    } catch (error) {
      this.logger.error(
        `cloudflare usage: could not save state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
