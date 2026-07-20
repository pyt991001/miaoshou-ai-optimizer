import { Queue } from "bullmq";
import { getEnv } from "@/lib/config/env";

export const queueName = "miaoshou-ai-processing";

export interface JobPayload {
  processingJobId: string;
  productIds: string[];
}

export function createRedisConnection() {
  const url = new URL(getEnv().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null
  };
}

export function createProcessingQueue() {
  return new Queue<JobPayload, JobPayload, string>(queueName, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 100
    }
  });
}
