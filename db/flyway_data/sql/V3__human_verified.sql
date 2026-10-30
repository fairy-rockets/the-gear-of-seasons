-- entity_annotations.checked を、何を確かめた印かが分かる名前にする（#58）。
-- Ollama が下書きする項目（medium・alt・description・tags・palette・looks_*）を、直した場合も含めて人がすべて確かめたか（#2）
ALTER TABLE "entity_annotations" RENAME COLUMN "checked" TO "human_verified";
