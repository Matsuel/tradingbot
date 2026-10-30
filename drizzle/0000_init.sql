CREATE TABLE "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"symbol" text NOT NULL,
	"price" double precision NOT NULL,
	"ema20" double precision,
	"ema50" double precision,
	"rsi" double precision,
	"atr" double precision,
	"signal" text,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equity_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"equity" double precision NOT NULL,
	"cash" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" double precision NOT NULL,
	"entry_price" double precision NOT NULL,
	"stop_loss" double precision NOT NULL,
	"take_profit" double precision NOT NULL,
	"entry_fee" double precision NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_reason" text NOT NULL,
	"exit_price" double precision,
	"exit_fee" double precision,
	"pnl" double precision,
	"closed_at" timestamp with time zone,
	"exit_reason" text
);
--> statement-breakpoint
CREATE INDEX "decisions_at" ON "decisions" USING btree ("at");--> statement-breakpoint
CREATE INDEX "equity_snapshots_at" ON "equity_snapshots" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_position_per_symbol" ON "positions" USING btree ("symbol") WHERE "positions"."closed_at" is null;