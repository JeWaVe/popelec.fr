import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_import_sessions_status" AS ENUM('scanning', 'ready', 'in_review', 'completed', 'failed');
    CREATE TYPE "public"."enum_product_candidates_status" AS ENUM('pending', 'confirmed', 'skipped', 'error');
    CREATE TYPE "public"."enum_product_candidates_proposed_source_currency" AS ENUM('USD', 'CNY', 'EUR');

    CREATE TABLE "import_sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "library_id" varchar NOT NULL,
      "library_name" varchar NOT NULL,
      "path" varchar DEFAULT '/',
      "status" "enum_import_sessions_status" DEFAULT 'scanning',
      "scan_started_at" timestamp(3) with time zone,
      "scan_completed_at" timestamp(3) with time zone,
      "file_tree_json" varchar,
      "llm_raw_response" varchar,
      "error_message" varchar,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "product_candidates_proposed_image_paths" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "path" varchar NOT NULL,
      "alt_fr" varchar,
      "alt_en" varchar
    );

    CREATE TABLE "product_candidates_proposed_datasheet_paths" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "path" varchar NOT NULL,
      "title_fr" varchar,
      "title_en" varchar
    );

    CREATE TABLE "product_candidates" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" integer NOT NULL,
      "index" numeric NOT NULL,
      "status" "enum_product_candidates_status" DEFAULT 'pending',
      "proposed_sku" varchar NOT NULL,
      "proposed_name" varchar NOT NULL,
      "proposed_name_en" varchar,
      "proposed_short_description" varchar,
      "proposed_short_description_en" varchar,
      "proposed_category_slug" varchar,
      "proposed_brand" varchar,
      "proposed_source_currency" "enum_product_candidates_proposed_source_currency" DEFAULT 'USD',
      "proposed_source_amount" numeric,
      "proposed_specs_json" varchar,
      "confirmed_product_id" integer,
      "error_message" varchar,
      "reviewed_at" timestamp(3) with time zone,
      "reviewed_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "product_candidates_proposed_image_paths" ADD CONSTRAINT "product_candidates_proposed_image_paths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_candidates"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "product_candidates_proposed_datasheet_paths" ADD CONSTRAINT "product_candidates_proposed_datasheet_paths_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_candidates"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_session_id_import_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."import_sessions"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_confirmed_product_id_products_id_fk" FOREIGN KEY ("confirmed_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "product_candidates" ADD CONSTRAINT "product_candidates_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "import_sessions_created_by_idx" ON "import_sessions" USING btree ("created_by_id");
    CREATE INDEX "import_sessions_updated_at_idx" ON "import_sessions" USING btree ("updated_at");
    CREATE INDEX "import_sessions_created_at_idx" ON "import_sessions" USING btree ("created_at");

    CREATE INDEX "product_candidates_proposed_image_paths_order_idx" ON "product_candidates_proposed_image_paths" USING btree ("_order");
    CREATE INDEX "product_candidates_proposed_image_paths_parent_id_idx" ON "product_candidates_proposed_image_paths" USING btree ("_parent_id");
    CREATE INDEX "product_candidates_proposed_datasheet_paths_order_idx" ON "product_candidates_proposed_datasheet_paths" USING btree ("_order");
    CREATE INDEX "product_candidates_proposed_datasheet_paths_parent_id_idx" ON "product_candidates_proposed_datasheet_paths" USING btree ("_parent_id");

    CREATE INDEX "product_candidates_session_idx" ON "product_candidates" USING btree ("session_id");
    CREATE INDEX "product_candidates_confirmed_product_idx" ON "product_candidates" USING btree ("confirmed_product_id");
    CREATE INDEX "product_candidates_reviewed_by_idx" ON "product_candidates" USING btree ("reviewed_by_id");
    CREATE INDEX "product_candidates_updated_at_idx" ON "product_candidates" USING btree ("updated_at");
    CREATE INDEX "product_candidates_created_at_idx" ON "product_candidates" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "import_sessions_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_candidates_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_sessions_fk" FOREIGN KEY ("import_sessions_id") REFERENCES "public"."import_sessions"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_candidates_fk" FOREIGN KEY ("product_candidates_id") REFERENCES "public"."product_candidates"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_import_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("import_sessions_id");
    CREATE INDEX "payload_locked_documents_rels_product_candidates_id_idx" ON "payload_locked_documents_rels" USING btree ("product_candidates_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_candidates_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_import_sessions_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_product_candidates_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_import_sessions_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "product_candidates_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "import_sessions_id";

    DROP TABLE IF EXISTS "product_candidates_proposed_datasheet_paths";
    DROP TABLE IF EXISTS "product_candidates_proposed_image_paths";
    DROP TABLE IF EXISTS "product_candidates";
    DROP TABLE IF EXISTS "import_sessions";

    DROP TYPE IF EXISTS "public"."enum_product_candidates_proposed_source_currency";
    DROP TYPE IF EXISTS "public"."enum_product_candidates_status";
    DROP TYPE IF EXISTS "public"."enum_import_sessions_status";
  `)
}
