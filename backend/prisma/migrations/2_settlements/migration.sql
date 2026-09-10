ALTER TABLE "Transaction"
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "reimbursedAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reimbursedAt" TIMESTAMP(3);

-- Preserve known full reimbursements; their historical receipt date is unknown.
-- Never infer payment from the due date.
UPDATE "Transaction" SET "reimbursedAmountCents" = "amountCents"
WHERE "isThirdParty" AND "isReimbursed";

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reimbursement_valid"
CHECK ("reimbursedAmountCents" >= 0 AND "reimbursedAmountCents" <= "amountCents"
  AND ("reimbursedAmountCents" = 0 OR ("isThirdParty" AND "type" = 'EXPENSE')));

CREATE INDEX "Transaction_paidAt_idx" ON "Transaction"("paidAt");
