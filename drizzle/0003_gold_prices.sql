CREATE TABLE "gold_prices" (
	"source" text NOT NULL,
	"country" text NOT NULL,
	"owner" text NOT NULL,
	"kind" text NOT NULL,
	"item" text NOT NULL,
	"buy" double precision,
	"sell" double precision,
	"price_updated_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gold_prices_source_owner_kind_item_pk" PRIMARY KEY("source","owner","kind","item")
);
