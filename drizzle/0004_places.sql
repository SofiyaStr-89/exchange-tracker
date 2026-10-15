CREATE TABLE "places" (
	"id" integer PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"name" text NOT NULL,
	"names" jsonb NOT NULL,
	"search" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_country_idx" ON "places" USING btree ("country");