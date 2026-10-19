"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Button, Field, Notice, useTask } from "./ui";
import { defaultSearchName, emptyFilters } from "@/lib/domain";
import type { JobFilters } from "@/lib/types";
export function SaveSearchBar({ filters }: { filters: JobFilters }) {
  const { state, mutate } = useWorkspace();
  const pathname = usePathname();
  const task = useTask();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const active =
    filters.q !== emptyFilters.q ||
    filters.city !== emptyFilters.city ||
    filters.department !== emptyFilters.department ||
    filters.propertyType !== emptyFilters.propertyType ||
    filters.salaryMin !== emptyFilters.salaryMin ||
    filters.stay !== emptyFilters.stay ||
    filters.meals !== emptyFilters.meals ||
    filters.sort !== emptyFilters.sort;
  if (!active) return null;
  if (state.role === null)
    return (
      <div className="save-search">
        <Link
          className="text-button"
          href={`/login?next=${encodeURIComponent(pathname)}`}
        >
          <Bell size={16} /> Sign in to save this search
        </Link>
      </div>
    );
  if (state.role !== "applicant") return null;
  return (
    <div className="save-search">
      {open ? (
        <form
          className="save-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await mutate({
                action: "savedSearch.save",
                payload: {
                  id: "",
                  name,
                  filters,
                  alerts: true,
                  createdAt: new Date().toISOString(),
                },
              });
              setOpen(false);
            }, "Search saved. Daily alerts are on.");
          }}
        >
          <Field label="Search name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </Field>
          <Button type="submit" busy={task.busy}>
            Save search
          </Button>
          <Button type="button" variant="text" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setName(defaultSearchName(filters));
            setOpen(true);
          }}
        >
          <Bell size={16} /> Save this search
        </Button>
      )}
      {task.message && <Notice message={task.message} error={task.error} />}
    </div>
  );
}
