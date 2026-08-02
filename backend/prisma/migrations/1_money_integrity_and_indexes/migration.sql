-- This migration is intentionally strict: make a database backup and run the
-- preflight script before applying it to an existing installation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Account"
    WHERE abs("balance") * 100 > 2147483647
       OR ("creditLimit" IS NOT NULL AND abs("creditLimit") * 100 > 2147483647)
  ) OR EXISTS (
    SELECT 1 FROM "Transaction" WHERE abs("amount") * 100 > 2147483647
  ) OR EXISTS (
    SELECT 1 FROM "InstallmentGroup" WHERE abs("totalAmount") * 100 > 2147483647
  ) OR EXISTS (
    SELECT 1 FROM "Subscription" WHERE abs("amount") * 100 > 2147483647
  ) OR EXISTS (
    SELECT 1 FROM "Alert" WHERE abs("limitAmount") * 100 > 2147483647
  ) THEN
    RAISE EXCEPTION 'A monetary value exceeds the supported integer-cent range';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Transaction"
    WHERE "subscriptionId" IS NOT NULL
    GROUP BY "subscriptionId", "subscriptionYear", "subscriptionMonth"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate subscription occurrences exist; resolve them before migrating';
  END IF;

  IF EXISTS (SELECT 1 FROM "Transaction" WHERE "amount" <= 0)
    OR EXISTS (SELECT 1 FROM "InstallmentGroup" WHERE "totalAmount" <= 0)
    OR EXISTS (SELECT 1 FROM "Subscription" WHERE "amount" <= 0)
    OR EXISTS (SELECT 1 FROM "Alert" WHERE "limitAmount" <= 0) THEN
    RAISE EXCEPTION 'A persisted monetary value violates the positive-value invariant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Transaction"
    WHERE ("subscriptionId" IS NULL) <> ("subscriptionYear" IS NULL)
       OR ("subscriptionId" IS NULL) <> ("subscriptionMonth" IS NULL)
  ) THEN
    RAISE EXCEPTION 'A subscription occurrence has a partially populated identity';
  END IF;
END $$;

ALTER TABLE "Account" RENAME COLUMN "balance" TO "openingBalanceCents";
ALTER TABLE "Account" ALTER COLUMN "openingBalanceCents" DROP DEFAULT;
ALTER TABLE "Account" ALTER COLUMN "openingBalanceCents" TYPE INTEGER
  USING round("openingBalanceCents" * 100)::INTEGER;
ALTER TABLE "Account" ALTER COLUMN "openingBalanceCents" SET DEFAULT 0;
ALTER TABLE "Account" RENAME COLUMN "creditLimit" TO "creditLimitCents";
ALTER TABLE "Account" ALTER COLUMN "creditLimitCents" TYPE INTEGER
  USING round("creditLimitCents" * 100)::INTEGER;

ALTER TABLE "Transaction" RENAME COLUMN "amount" TO "amountCents";
ALTER TABLE "Transaction" ALTER COLUMN "amountCents" TYPE INTEGER
  USING round("amountCents" * 100)::INTEGER;

ALTER TABLE "InstallmentGroup" RENAME COLUMN "totalAmount" TO "totalAmountCents";
ALTER TABLE "InstallmentGroup" ALTER COLUMN "totalAmountCents" TYPE INTEGER
  USING round("totalAmountCents" * 100)::INTEGER;

ALTER TABLE "Subscription" RENAME COLUMN "amount" TO "amountCents";
ALTER TABLE "Subscription" ALTER COLUMN "amountCents" TYPE INTEGER
  USING round("amountCents" * 100)::INTEGER;

ALTER TABLE "Alert" RENAME COLUMN "limitAmount" TO "limitAmountCents";
ALTER TABLE "Alert" ALTER COLUMN "limitAmountCents" TYPE INTEGER
  USING round("limitAmountCents" * 100)::INTEGER;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_amountCents_positive" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "Transaction_subscription_occurrence_complete" CHECK (
    ("subscriptionId" IS NULL AND "subscriptionYear" IS NULL AND "subscriptionMonth" IS NULL)
    OR
    ("subscriptionId" IS NOT NULL AND "subscriptionYear" IS NOT NULL AND "subscriptionMonth" IS NOT NULL)
  );
ALTER TABLE "InstallmentGroup"
  ADD CONSTRAINT "InstallmentGroup_totalAmountCents_positive" CHECK ("totalAmountCents" > 0),
  ADD CONSTRAINT "InstallmentGroup_count_valid" CHECK (
    "installmentCount" BETWEEN 2 AND 120 AND "totalAmountCents" >= "installmentCount"
  );
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_amountCents_positive" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "Subscription_billingDay_valid" CHECK ("billingDay" BETWEEN 1 AND 31);
ALTER TABLE "Alert"
  ADD CONSTRAINT "Alert_limitAmountCents_positive" CHECK ("limitAmountCents" > 0);
ALTER TABLE "Account"
  ADD CONSTRAINT "Account_creditLimitCents_positive" CHECK ("creditLimitCents" IS NULL OR "creditLimitCents" > 0),
  ADD CONSTRAINT "Account_closingDay_valid" CHECK ("closingDay" IS NULL OR "closingDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "Account_dueDay_valid" CHECK ("dueDay" IS NULL OR "dueDay" BETWEEN 1 AND 31);
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_subscriptionMonth_valid" CHECK (
    "subscriptionMonth" IS NULL OR "subscriptionMonth" BETWEEN 1 AND 12
  ),
  ADD CONSTRAINT "Transaction_subscriptionYear_valid" CHECK (
    "subscriptionYear" IS NULL OR "subscriptionYear" BETWEEN 2000 AND 2200
  );

-- Controller-driven deletion disconnects preserved historical occurrences
-- first. Cascade is a safe fallback for direct database deletes and avoids a
-- partial occurrence tuple during an ON DELETE SET NULL action.
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_subscriptionId_fkey";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Transaction_subscriptionId_subscriptionYear_subscriptionMonth_key"
  ON "Transaction"("subscriptionId", "subscriptionYear", "subscriptionMonth");
CREATE INDEX "Transaction_effectiveDate_id_idx" ON "Transaction"("effectiveDate", "id");
CREATE INDEX "Transaction_accountId_effectiveDate_idx" ON "Transaction"("accountId", "effectiveDate");
CREATE INDEX "Transaction_categoryId_effectiveDate_idx" ON "Transaction"("categoryId", "effectiveDate");
CREATE INDEX "Transaction_installmentGroupId_installmentNumber_idx"
  ON "Transaction"("installmentGroupId", "installmentNumber");
CREATE INDEX "InstallmentGroup_accountId_idx" ON "InstallmentGroup"("accountId");
CREATE INDEX "InstallmentGroup_categoryId_idx" ON "InstallmentGroup"("categoryId");
CREATE INDEX "Subscription_isActive_startDate_idx" ON "Subscription"("isActive", "startDate");
CREATE INDEX "Subscription_accountId_idx" ON "Subscription"("accountId");
CREATE INDEX "Subscription_categoryId_idx" ON "Subscription"("categoryId");
CREATE INDEX "Alert_categoryId_idx" ON "Alert"("categoryId");
