-- Lock the category while writing a dependent row, serializing this operation
-- with category type changes (including clients other than this API).
CREATE FUNCTION validate_category_type() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_type text; actual_type text;
BEGIN
  IF TG_TABLE_NAME = 'Transaction' THEN expected_type := NEW."type"::text;
  ELSE expected_type := 'EXPENSE'; END IF;
  SELECT "type"::text INTO actual_type FROM "Category" WHERE id = NEW."categoryId" FOR SHARE;
  IF actual_type IS DISTINCT FROM expected_type THEN
    RAISE EXCEPTION 'Category type must match %', expected_type USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER transaction_category_type BEFORE INSERT OR UPDATE OF "categoryId", "type" ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION validate_category_type();
CREATE TRIGGER installment_category_type BEFORE INSERT OR UPDATE OF "categoryId" ON "InstallmentGroup"
FOR EACH ROW EXECUTE FUNCTION validate_category_type();
CREATE TRIGGER subscription_category_type BEFORE INSERT OR UPDATE OF "categoryId" ON "Subscription"
FOR EACH ROW EXECUTE FUNCTION validate_category_type();
CREATE TRIGGER alert_category_type BEFORE INSERT OR UPDATE OF "categoryId" ON "Alert"
FOR EACH ROW EXECUTE FUNCTION validate_category_type();

CREATE FUNCTION protect_used_category_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."type" <> OLD."type" AND (
    EXISTS (SELECT 1 FROM "Transaction" WHERE "categoryId" = OLD.id) OR
    EXISTS (SELECT 1 FROM "InstallmentGroup" WHERE "categoryId" = OLD.id) OR
    EXISTS (SELECT 1 FROM "Subscription" WHERE "categoryId" = OLD.id) OR
    EXISTS (SELECT 1 FROM "Alert" WHERE "categoryId" = OLD.id)
  ) THEN
    RAISE EXCEPTION 'Cannot change the type of a category in use' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER category_type_in_use BEFORE UPDATE OF "type" ON "Category"
FOR EACH ROW EXECUTE FUNCTION protect_used_category_type();
