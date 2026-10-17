-- ts-postgresが対応してないので ENUM ではなく varchar + CHECK にする（V0 の entities.type と同じ）
-- https://github.com/malthe/ts-postgres/issues/43

-- 既存の moment はすべて公開済みとして埋める
ALTER TABLE "moments" ADD COLUMN "status" varchar(16) NOT NULL DEFAULT 'published';
-- 以降の新規行は下書き。アプリは常に status を明示して INSERT するので、これは手動 INSERT などの安全網
ALTER TABLE "moments" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "moments" ADD CONSTRAINT "moments_status_check" CHECK ("status" IN ('draft', 'published'));
