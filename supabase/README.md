# Supabase / Postgres migrations

This folder holds the canonical SQL for the YEG x L'Oreal event-planning
tool. Files are plain SQL and are meant to be executed, in order, against
a Supabase Postgres instance (e.g. via the Supabase SQL editor or `psql`).

## Run order

Apply the files in this exact sequence. Earlier files are prerequisites
of later ones (columns, tables and FKs assume the previous steps have
already run).

1. `schema.sql` — initial base schema (fornitori generic, progetti,
   proposte, storico, indexes, triggers).
2. `migrate_category_tables.sql` — category-specific supplier tables
   (`fornitori_hotel`, `fornitori_location`, `fornitori_catering`,
   `fornitori_dmc`, `fornitori_teambuilding`, `fornitori_ristoranti`,
   `fornitori_allestimenti`, `fornitori_entertainment`,
   `fornitori_trasporti`).
3. `migrate_pro_contro.sql` — adds pro/contro columns.
4. `migrate_cost_features.sql` — adds cost-tracking columns.
5. `migrate_immagini.sql` — adds image-gallery columns.
6. `migrate_email_logs.sql` — **FIXED version** (see warning below).
   Creates the `email_logs` table with the correct FK types
   (`progetto_id TEXT`, `proposta_id INT`).
7. `migrate_email_logs_tracking.sql` — **NEW.** Adds `message_id` and
   `thread_token` columns + indexes for reliable reply correlation.
8. `migrate_email_verified.sql` — **NEW.** Adds `email_verified` and
   `email_verification_error` columns on `proposte` for MX pre-checks
   before outbound sending.
9. `migrate_rls_enable.sql` — **NEW.** Enables Row Level Security on
   all application tables and installs service-role-only policies so
   the public anon key cannot read/write from the client.

`functions.sql` is loaded as needed (ad-hoc helpers); it is not part
of the ordered migration chain above.

## IMPORTANT — fixing a broken `email_logs` install

An earlier version of `migrate_email_logs.sql` declared the FKs with
the wrong types:

- `progetto_id UUID` — wrong. `progetti.id` is `TEXT` (format
  `'PRJ-<epoch>'`, see `schema.sql`).
- `proposta_id BIGINT` — wrong. `proposte.id` is `SERIAL` (i.e. `INT`).

If your database has `email_logs` created with those wrong types, the
fixed migration cannot simply be re-run: `CREATE TABLE IF NOT EXISTS`
will be a no-op and the column types will stay wrong.

You must drop the broken table manually first. **This is destructive
and will remove any rows already stored in `email_logs`:**

```sql
DROP TABLE email_logs CASCADE;
```

Then re-run `migrate_email_logs.sql` (which will create it with the
correct types), followed by `migrate_email_logs_tracking.sql` and
`migrate_rls_enable.sql`.

If `email_logs` does not yet exist in your database, you can skip the
drop and just apply the migrations in the order listed above.
