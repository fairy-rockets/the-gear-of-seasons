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
  "date" timestamp AT TIME ZONE 'JST' NOT NULL PRIMARY KEY,
  "title" varchar(300) NOT NULL,
  "author" varchar(300) NOT NULL,
  "text" text NOT NULL,
  "created" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE ENTITY_TYPE AS ENUM ('image', 'video', 'audio');

CREATE TABLE "entities" (
  "id" varchar(20) NOT NULL PRIMARY KEY,
  "type" ENTITY_TYPE NOT NULL,
  "path" varchar(1024) NOT NULL,
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
