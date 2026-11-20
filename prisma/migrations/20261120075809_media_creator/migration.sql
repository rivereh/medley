-- AlterTable
ALTER TABLE "Media" ADD COLUMN "creator" TEXT;

-- Fill it in for titles already saved, from the Channel / Author fact.
UPDATE "Media"
SET "creator" = (
  SELECT json_extract(f.value, '$.value')
  FROM json_each("Media"."facts") AS f
  WHERE json_extract(f.value, '$.label') IN ('Channel', 'Author', 'Authors')
  LIMIT 1
)
WHERE "creator" IS NULL AND "facts" IS NOT NULL AND json_valid("facts");
