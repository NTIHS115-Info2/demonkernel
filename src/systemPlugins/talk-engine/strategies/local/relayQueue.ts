type RelayQueueOptions<T> = {
  handler: (item: T) => Promise<void>;
  onError: (item: T, error: unknown) => void;
  logger?: {
    info: (message: unknown, meta?: Record<string, unknown>) => void;
  };
};

export class RelayQueue<T> {
  private readonly queue: T[] = [];
  private readonly handler: (item: T) => Promise<void>;
  private readonly onError: (item: T, error: unknown) => void;
  private readonly logger?: {
    info: (message: unknown, meta?: Record<string, unknown>) => void;
  };
  private active = false;
  private stopping = false;
  private idleResolvers: Array<() => void> = [];

  constructor(options: RelayQueueOptions<T>) {
    this.handler = options.handler;
    this.onError = options.onError;
    this.logger = options.logger;
  }

  private logInfo(message: string, meta: Record<string, unknown> = {}): void {
    this.logger?.info(message, {
      stage: "relay-queue",
      ...meta,
    });
  }

  // 中英註解：此 queue 固定 FIFO，避免多筆 Discord 對話同時處理造成回覆交錯。
  // EN: Keep strict FIFO so Discord replies do not interleave across messages.
  enqueue(item: T): void {
    if (this.stopping) {
      this.logInfo("relay queue drop item due to stopping", {
        action: "queue.enqueue.drop",
        queueLength: this.queue.length,
      });
      return;
    }

    this.queue.push(item);
    this.logInfo("relay queue enqueue", {
      action: "queue.enqueue",
      queueLength: this.queue.length,
      active: this.active,
    });
    if (!this.active) {
      void this.drain();
    }
  }

  async stop(): Promise<void> {
    this.logInfo("relay queue stop begin", {
      action: "queue.stop.begin",
      queueLength: this.queue.length,
      active: this.active,
    });
    this.stopping = true;
    this.queue.length = 0;

    if (!this.active) {
      this.logInfo("relay queue stop complete", {
        action: "queue.stop.complete",
        queueLength: this.queue.length,
        active: this.active,
      });
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
    this.logInfo("relay queue stop complete", {
      action: "queue.stop.complete",
      queueLength: this.queue.length,
      active: this.active,
    });
  }

  private async drain(): Promise<void> {
    if (this.active) {
      return;
    }

    this.active = true;
    this.logInfo("relay queue drain begin", {
      action: "queue.drain.begin",
      queueLength: this.queue.length,
    });

    while (this.queue.length > 0 && !this.stopping) {
      const item = this.queue.shift() as T;
      this.logInfo("relay queue dequeue", {
        action: "queue.dequeue",
        queueLength: this.queue.length,
      });
      try {
        await this.handler(item);
      } catch (error) {
        this.onError(item, error);
      }
    }

    this.active = false;
    this.logInfo("relay queue drain complete", {
      action: "queue.drain.complete",
      queueLength: this.queue.length,
      stopping: this.stopping,
    });
    const resolvers = [...this.idleResolvers];
    this.idleResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
