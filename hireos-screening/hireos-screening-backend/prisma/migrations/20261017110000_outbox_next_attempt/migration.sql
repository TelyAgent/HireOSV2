-- When a failed handoff event may be retried (#384). Null means at once.
ALTER TABLE "ScreeningOutboxEvent" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);
