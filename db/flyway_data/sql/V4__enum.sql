-- 決まった値の中から選ぶ列を、varchar + CHECK から ENUM にする。
-- 値の並びは server/src/lib/protocol.ts の型・定数と同じ。

CREATE TYPE "entity_type" AS ENUM ('image', 'video', 'audio');
CREATE TYPE "moment_status" AS ENUM ('draft', 'published');
CREATE TYPE "moment_tier" AS ENUM ('pickup', 'archive', 'sketch', 'hidden');
CREATE TYPE "annotation_medium" AS ENUM ('drawing', 'photo', '3d', 'generated', 'graphic');
CREATE TYPE "annotation_palette" AS ENUM ('color', 'monochrome');
CREATE TYPE "looks_nude" AS ENUM ('nude', 'partial', 'unclear', 'none');
CREATE TYPE "looks_child" AS ENUM ('child', 'ambiguous', 'adult', 'none');
CREATE TYPE "annotation_role" AS ENUM ('grab', 'both', 'deep', 'none');

-- 型を変える列の既定値は、型を変えるあいだ外しておく（varchar の既定値は ENUM に自動では変換されない）。
ALTER TABLE "entities"
  ALTER COLUMN "type" TYPE "entity_type" USING "type"::"entity_type";

ALTER TABLE "moments"
  DROP CONSTRAINT "moments_status_check",
  DROP CONSTRAINT "moments_tier_check",
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "tier" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "moment_status" USING "status"::"moment_status",
  ALTER COLUMN "tier" TYPE "moment_tier" USING "tier"::"moment_tier",
  ALTER COLUMN "status" SET DEFAULT 'draft',
  ALTER COLUMN "tier" SET DEFAULT 'archive';

ALTER TABLE "entity_annotations"
  DROP CONSTRAINT "entity_annotations_medium_check",
  DROP CONSTRAINT "entity_annotations_palette_check",
  DROP CONSTRAINT "entity_annotations_looks_nude_check",
  DROP CONSTRAINT "entity_annotations_looks_child_check",
  DROP CONSTRAINT "entity_annotations_role_check",
  ALTER COLUMN "medium" TYPE "annotation_medium" USING "medium"::"annotation_medium",
  ALTER COLUMN "palette" TYPE "annotation_palette" USING "palette"::"annotation_palette",
  ALTER COLUMN "looks_nude" TYPE "looks_nude" USING "looks_nude"::"looks_nude",
  ALTER COLUMN "looks_child" TYPE "looks_child" USING "looks_child"::"looks_child",
  ALTER COLUMN "role" TYPE "annotation_role" USING "role"::"annotation_role";
