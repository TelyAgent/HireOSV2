UPDATE "InterviewTask"
SET "offerState" = 'failed', "offerError" = 'LEGACY_SENT_REQUIRES_RETRY'
WHERE "offerState" = 'sent';
