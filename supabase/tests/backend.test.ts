import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { departments, propertyTypes } from "../../src/lib/taxonomy";

describe("database authorization and immutable application records", () => {
  it("enforces identity, moderation, ownership, versioning, filtering and suspension", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create schema auth;
        create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        grant usage on schema auth to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;
      `);
      const migrations = resolve("supabase/migrations");
      for (const name of readdirSync(migrations)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await db.exec(readFileSync(resolve(migrations, name), "utf8"));
      }
      const catalog = await db.query<{ department: string; role: string }>(
        "select department, role from private.hospitality_roles order by department,role",
      );
      const expectedRoles = Object.entries(departments)
        .flatMap(([department, roles]) =>
          roles.map((role) => ({ department, role })),
        )
        .sort(
          (a, b) =>
            a.department.localeCompare(b.department) ||
            a.role.localeCompare(b.role),
        );
      expect(catalog.rows).toEqual(expectedRoles);
      const properties = await db.query<{ name: string }>(
        "select name from private.hospitality_property_types order by name",
      );
      expect(properties.rows.map(({ name }) => name)).toEqual(
        [...propertyTypes].sort(),
      );
      for (const name of readdirSync(resolve("supabase/tests"))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await db.exec(readFileSync(resolve("supabase/tests", name), "utf8"));
      }
    } finally {
      await db.close();
    }
  }, 60_000);
});
