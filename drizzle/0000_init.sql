CREATE TABLE "city_fetches" (
	"source" text NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"fetched_at" timestamp with time zone,
	"status" text NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "city_fetches_source_country_city_pk" PRIMARY KEY("source","country","city")
);
--> statement-breakpoint
CREATE TABLE "exchangers" (
	"id" text PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"name" text NOT NULL,
	"bank" text,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"coords_source" text,
	"hours" jsonb,
	"source_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"exchanger_id" text NOT NULL,
	"currency" text NOT NULL,
	"buy" double precision,
	"sell" double precision,
	"rate_updated_at" timestamp with time zone,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rates_exchanger_id_currency_source_pk" PRIMARY KEY("exchanger_id","currency","source")
);
--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_exchanger_id_exchangers_id_fk" FOREIGN KEY ("exchanger_id") REFERENCES "public"."exchangers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchangers_lat_lng_idx" ON "exchangers" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "exchangers_city_idx" ON "exchangers" USING btree ("country","city");