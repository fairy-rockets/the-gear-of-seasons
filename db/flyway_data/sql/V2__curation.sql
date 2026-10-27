-- ts-postgresが対応してないので ENUM ではなく varchar + CHECK にする（V0 の entities.type と同じ）
-- https://github.com/malthe/ts-postgres/issues/43

-- moment ごとのキュレーションの項目。既存の moment は archive・series なし・sensitive でないとして埋める
ALTER TABLE "moments" ADD COLUMN "tier" varchar(16) NOT NULL DEFAULT 'archive';
ALTER TABLE "moments" ADD CONSTRAINT "moments_tier_check" CHECK ("tier" IN ('pickup', 'archive', 'sketch', 'hidden'));
ALTER TABLE "moments" ADD COLUMN "series" text[] NOT NULL DEFAULT '{}';
-- sensitive_manual = false の間は、アプリが書き込むたびに本文と entity_annotations から計算し直して保つ
ALTER TABLE "moments" ADD COLUMN "sensitive" boolean NOT NULL DEFAULT false;
ALTER TABLE "moments" ADD COLUMN "sensitive_manual" boolean NOT NULL DEFAULT false;

-- メディア（entity）ごとの注釈。checked 以外の NULL は「値なし」で、'none' や '{}' とは別の値
-- 種類ごとに持たない項目（音声の medium・looks_* など）は、アプリの側で弾く
CREATE TABLE "entity_annotations" (
  "entity_id" char(32) NOT NULL PRIMARY KEY REFERENCES "entities" ("id") ON DELETE CASCADE,
  "medium" varchar(16) CHECK ("medium" IN ('drawing', 'photo', '3d', 'generated', 'graphic')),
  "alt" text,
  "description" text,
  "tags" text[],
  "palette" varchar(16) CHECK ("palette" IN ('color', 'monochrome')),
  "characters" text[],
  "looks_nude" varchar(16) CHECK ("looks_nude" IN ('nude', 'partial', 'unclear', 'none')),
  "looks_child" varchar(16) CHECK ("looks_child" IN ('child', 'ambiguous', 'adult', 'none')),
  "looks_note" text,
  "checked" boolean NOT NULL DEFAULT false,
  "role" varchar(8) CHECK ("role" IN ('grab', 'both', 'deep', 'none')),
  "role_group" text,
  "role_star" boolean,
  "role_note" text,
  "created" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER entity_annotations_modify_updated
  BEFORE UPDATE
  ON "entity_annotations"
  FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();
