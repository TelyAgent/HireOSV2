-- A dispatcher claims an event (status sending) for a while before delivering it (#385).
ALTER TABLE "ScreeningOutboxEvent" ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMP(3);
