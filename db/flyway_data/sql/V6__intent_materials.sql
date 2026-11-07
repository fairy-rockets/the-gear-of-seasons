-- moment のねらい・解釈・振り返り（#80）。moment ごとに1つで、omote には出さない。NULL は未入力。
ALTER TABLE "moments" ADD COLUMN "intent" text;

-- メディアごとの、使った画材の集合（#80）。値は決めていないので ENUM にしない。
-- ほかの注釈と同じく、NULL は未入力で、'{}' とは別の値。
ALTER TABLE "entity_annotations" ADD COLUMN "materials" text[];
