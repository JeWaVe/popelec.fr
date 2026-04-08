import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "import_meta_locked" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "import_meta_last_imported_at" timestamp(3) with time zone;
  ALTER TABLE "products" ADD COLUMN "import_meta_source" varchar;
  ALTER TABLE "products" ADD COLUMN "import_meta_fx_snapshot" varchar;
  ALTER TABLE "_products_v" ADD COLUMN "version_import_meta_locked" boolean DEFAULT false;
  ALTER TABLE "_products_v" ADD COLUMN "version_import_meta_last_imported_at" timestamp(3) with time zone;
  ALTER TABLE "_products_v" ADD COLUMN "version_import_meta_source" varchar;
  ALTER TABLE "_products_v" ADD COLUMN "version_import_meta_fx_snapshot" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN "import_meta_locked";
  ALTER TABLE "products" DROP COLUMN "import_meta_last_imported_at";
  ALTER TABLE "products" DROP COLUMN "import_meta_source";
  ALTER TABLE "products" DROP COLUMN "import_meta_fx_snapshot";
  ALTER TABLE "_products_v" DROP COLUMN "version_import_meta_locked";
  ALTER TABLE "_products_v" DROP COLUMN "version_import_meta_last_imported_at";
  ALTER TABLE "_products_v" DROP COLUMN "version_import_meta_source";
  ALTER TABLE "_products_v" DROP COLUMN "version_import_meta_fx_snapshot";`)
}
