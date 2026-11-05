-- サーバーの外にあるリソース（YouTube の動画など）を entity として扱えるようにする（#17）。
-- location は entity の元の置き場所。internal は元ファイルを _storage/original に持つもの、
-- external はサーバーの外にあり、external でそれを指すもの。external の entity は icon だけを storage に持つ。
CREATE TYPE "entity_location" AS ENUM ('internal', 'external');

-- いまある行は internal で埋める。そのあと既定値を外し、新しく INSERT するときは location の指定を必須にする
-- （指定し忘れると NOT NULL で弾かれる）。
ALTER TABLE "entities" ADD COLUMN "location" "entity_location" NOT NULL DEFAULT 'internal';
ALTER TABLE "entities" ALTER COLUMN "location" DROP DEFAULT;

-- external の entity が指すもの。platform ごとに、それを指すのに要る項目を持つ
-- （YouTube は {"platform": "youtube", "id": "<11文字の動画ID>"}）。中身の検証はアプリが platform ごとに行う。
-- ページや埋め込みの URL は持たず、アプリが platform ごとに中身から組み立てる。
ALTER TABLE "entities" ADD COLUMN "external" jsonb
  CHECK ("external" IS NULL OR (jsonb_typeof("external") = 'object' AND "external" ? 'platform'));
ALTER TABLE "entities" ADD CONSTRAINT "entities_location_external_check"
  CHECK (("location" = 'external') = ("external" IS NOT NULL));
-- external になれるのは video だけ。
ALTER TABLE "entities" ADD CONSTRAINT "entities_location_type_check"
  CHECK ("location" = 'internal' OR "type" = 'video');

-- mime_type は元ファイルの種類なので、元ファイルを持つ internal だけが持ち、external は NULL にする。
ALTER TABLE "entities" ALTER COLUMN "mime_type" DROP NOT NULL;
ALTER TABLE "entities" ADD CONSTRAINT "entities_location_mime_type_check"
  CHECK (("location" = 'internal') = ("mime_type" IS NOT NULL));
