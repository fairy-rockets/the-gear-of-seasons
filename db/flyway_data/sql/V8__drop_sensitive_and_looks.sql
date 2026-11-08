-- moment の sensitive と、メディアの注釈の looks_* をやめる（#2）。
-- 出すかどうかの基準はプラットフォームごとに違い（Misskey では大人の水着でも NSFW）、
-- 「裸か」「子どもに見えるか」を持っていても判断の材料にならないため。
ALTER TABLE "moments" DROP COLUMN "sensitive";
ALTER TABLE "moments" DROP COLUMN "sensitive_manual";

ALTER TABLE "entity_annotations" DROP COLUMN "looks_nude";
ALTER TABLE "entity_annotations" DROP COLUMN "looks_child";
ALTER TABLE "entity_annotations" DROP COLUMN "looks_note";
DROP TYPE "looks_nude";
DROP TYPE "looks_child";
