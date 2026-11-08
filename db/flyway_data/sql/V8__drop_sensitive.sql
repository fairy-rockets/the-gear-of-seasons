-- moment の sensitive をやめる（#2）。プラットフォームごとに基準が違い、1つの bool では表せないため。
-- 何が描かれているかは、entity_annotations の looks_* に残る。
ALTER TABLE "moments" DROP COLUMN "sensitive";
ALTER TABLE "moments" DROP COLUMN "sensitive_manual";
