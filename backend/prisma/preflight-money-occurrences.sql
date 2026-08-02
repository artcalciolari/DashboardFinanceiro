-- Run against a backup/restorable database before `prisma migrate deploy`.
-- Any unsafe value aborts the command, making this suitable for CI/CD gates.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Account"
    WHERE "balance" <> round("balance"::numeric, 2)
       OR ("creditLimit" IS NOT NULL AND "creditLimit" <> round("creditLimit"::numeric, 2))
  ) OR EXISTS (
    SELECT 1 FROM "Transaction" WHERE "amount" <> round("amount"::numeric, 2)
  ) OR EXISTS (
    SELECT 1 FROM "InstallmentGroup" WHERE "totalAmount" <> round("totalAmount"::numeric, 2)
  ) OR EXISTS (
    SELECT 1 FROM "Subscription" WHERE "amount" <> round("amount"::numeric, 2)
  ) OR EXISTS (
    SELECT 1 FROM "Alert" WHERE "limitAmount" <> round("limitAmount"::numeric, 2)
  ) THEN
    RAISE EXCEPTION 'A monetary value has more than two decimal places';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Transaction"
    WHERE "subscriptionId" IS NOT NULL
    GROUP BY "subscriptionId", "subscriptionYear", "subscriptionMonth"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate subscription occurrences exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Transaction"
    WHERE ("subscriptionId" IS NULL) <> ("subscriptionYear" IS NULL)
       OR ("subscriptionId" IS NULL) <> ("subscriptionMonth" IS NULL)
  ) THEN
    RAISE EXCEPTION 'A subscription occurrence has a partially populated identity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "InstallmentGroup"
    WHERE round("totalAmount" * 100) < "installmentCount"
  ) THEN
    RAISE EXCEPTION 'An installment group is smaller than one cent per installment';
  END IF;
END $$;

-- Keep a human-readable audit in deployment logs after assertions pass.
SELECT 'Account.openingBalance' AS field, count(*) AS values_with_extra_decimals
FROM "Account" WHERE "balance" <> round("balance"::numeric, 2)
UNION ALL
SELECT 'Account.creditLimit', count(*) FROM "Account"
WHERE "creditLimit" IS NOT NULL AND "creditLimit" <> round("creditLimit"::numeric, 2)
UNION ALL
SELECT 'Transaction.amount', count(*) FROM "Transaction"
WHERE "amount" <> round("amount"::numeric, 2)
UNION ALL
SELECT 'InstallmentGroup.totalAmount', count(*) FROM "InstallmentGroup"
WHERE "totalAmount" <> round("totalAmount"::numeric, 2)
UNION ALL
SELECT 'Subscription.amount', count(*) FROM "Subscription"
WHERE "amount" <> round("amount"::numeric, 2)
UNION ALL
SELECT 'Alert.limitAmount', count(*) FROM "Alert"
WHERE "limitAmount" <> round("limitAmount"::numeric, 2);

SELECT "subscriptionId", "subscriptionYear", "subscriptionMonth", count(*) AS occurrences
FROM "Transaction"
WHERE "subscriptionId" IS NOT NULL
GROUP BY "subscriptionId", "subscriptionYear", "subscriptionMonth"
HAVING count(*) > 1
ORDER BY occurrences DESC;

SELECT id, "subscriptionId", "subscriptionYear", "subscriptionMonth"
FROM "Transaction"
WHERE ("subscriptionId" IS NULL) <> ("subscriptionYear" IS NULL)
   OR ("subscriptionId" IS NULL) <> ("subscriptionMonth" IS NULL);

SELECT id, "totalAmount", "installmentCount"
FROM "InstallmentGroup"
WHERE round("totalAmount" * 100) < "installmentCount";
