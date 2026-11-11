-- moment の tier の値の名前を変え、使っていない hidden をなくす（#99）。
-- pickup は「代表作」として強すぎるので、作者の手応え（よく撮れた・よく描けた）の favorite にする。代表作はシリーズで別に選ぶ（#2）。
-- archive は「しまってあるもの」の意味が強いので normal に、sketch は絵の言葉で写真・音楽に合わないので rough にする。
-- サイトに出さない moment は status = draft で隠せるので、hidden は要らない。
-- ENUM から値は消せないので、新しい型を作って入れ替える。
CREATE TYPE "moment_tier_new" AS ENUM ('favorite', 'normal', 'rough');

ALTER TABLE "moments"
  ALTER COLUMN "tier" DROP DEFAULT,
  ALTER COLUMN "tier" TYPE "moment_tier_new" USING (CASE "tier"
    WHEN 'pickup' THEN 'favorite'
    WHEN 'archive' THEN 'normal'
    WHEN 'sketch' THEN 'rough'
  END)::"moment_tier_new",
  ALTER COLUMN "tier" SET DEFAULT 'normal';

DROP TYPE "moment_tier";
ALTER TYPE "moment_tier_new" RENAME TO "moment_tier";
