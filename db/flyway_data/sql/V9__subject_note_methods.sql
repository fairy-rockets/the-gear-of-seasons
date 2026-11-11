-- メディアの注釈の配役（role・role_group・role_star・role_note）を、主題（subject）と補足（note）にする（#95）。
-- 縮小したときの強さを手で判定しても得るものが少なく、role_note には主題と補足が混ざっていたため。
-- 移す前の配役は studio の promotion/docs/配役.yaml に退避してある（fairy-rockets/studio#177）。
-- どちらも自由記述で、ほかの注釈と同じく NULL は未入力。
ALTER TABLE "entity_annotations"
  ADD COLUMN "subject" text,
  ADD COLUMN "note" text;

-- 写真の role_note は機械生成の主題なので subject に移す。人が確かめた値ではないので human_verified を外す。
-- 移し方は medium で分けるので、medium を methods に変えるより先に行う。
UPDATE "entity_annotations"
  SET "subject" = "role_note", "human_verified" = false
  WHERE "medium" = 'camera' AND "role_note" IS NOT NULL;

-- 写真以外（medium が NULL のものも含む）の role_note は、role_group を前に付けて note に移す。human_verified は変えない。
-- role_note の無いもの（role_group だけのもの）は移さない。
UPDATE "entity_annotations"
  SET "note" = CASE
    WHEN "role_group" IS NULL OR "role_group" = '' THEN "role_note"
    ELSE '[' || "role_group" || '] ' || "role_note"
  END
  WHERE "medium" IS DISTINCT FROM 'camera' AND "role_note" IS NOT NULL;

ALTER TABLE "entity_annotations"
  DROP COLUMN "role",
  DROP COLUMN "role_group",
  DROP COLUMN "role_star",
  DROP COLUMN "role_note";
DROP TYPE "annotation_role";

-- medium（1つの値）を、作り方の集合の methods にする（#95）。順序のない集合で、NULL は未入力。
-- 空の配列・重複はアプリの側で弾き、並びは server/src/lib/protocol.ts の kAnnotationMethods の順にそろえて書く。
CREATE TYPE "annotation_method" AS ENUM ('draw', 'capture', 'render', 'generate', 'compose');
ALTER TABLE "entity_annotations" ADD COLUMN "methods" "annotation_method"[];

UPDATE "entity_annotations"
  SET "methods" = CASE "medium"
    WHEN 'drawing' THEN '{draw}'::"annotation_method"[]
    -- graphic はどれも Google Slides で描いた図なので、描いたものとする。
    WHEN 'graphic' THEN '{draw}'::"annotation_method"[]
    WHEN 'camera' THEN '{capture}'::"annotation_method"[]
    WHEN '3d' THEN '{render}'::"annotation_method"[]
    WHEN 'generated' THEN '{generate}'::"annotation_method"[]
  END
  WHERE "medium" IS NOT NULL;

ALTER TABLE "entity_annotations" DROP COLUMN "medium";
DROP TYPE "annotation_medium";

-- human_verified は、自動での下書きの有無とは関係なく、その種類が持つ項目をすべて人が入力し、確かめたか（#94・#95）。
-- 音声も持つ（列はもともとすべての行にある）。
