ALTER DATABASE "the-gear-of-seasons" SET timezone TO 'Asia/Tokyo';

CREATE FUNCTION update_timestamp() RETURNS TRIGGER
  LANGUAGE plpgsql
AS
$$
BEGIN
  NEW.updated = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TABLE "moments" (
  "timestamp" timestamp NOT NULL PRIMARY KEY,
  "title" varchar(300) NOT NULL,
  "author" varchar(300) NOT NULL,
  "text" text NOT NULL,
  "icon_id" char(32),
  "created" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ts-postgresが対応してない
-- https://github.com/malthe/ts-postgres/issues/43
-- CREATE TYPE ENTITY_TYPE AS ENUM ('image', 'video', 'audio');

CREATE TABLE "entities" (
  "id" char(32) NOT NULL PRIMARY KEY,
  "medium_id" char(32),
  "icon_id" char(32) NOT NULL,
  "timestamp" timestamp with time zone,
  "type" varchar(8) NOT NULL,
--  "type" ENTITY_TYPE NOT NULL,
  "mime_type" varchar(64) NOT NULL,
  "width" integer,
  "height" integer,
  "duration" real,
  "created" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER moments_modify_updated
  BEFORE UPDATE
  ON "moments"
  FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER entities_modify_updated
  BEFORE UPDATE
  ON "entities"
  FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();
