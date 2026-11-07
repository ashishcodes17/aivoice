"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { NAV } from "@/components/dashboard/app-sidebar";

const TITLES: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items).map((i) => [i.href.split("/")[2] ?? "", i.label]),
);

// "/dashboard/calls/abc" -> Dashboard / Calls / Details. Raw ids and phone numbers are not shown.
export function Breadcrumbs() {
  const parts = usePathname().split("/").filter(Boolean).slice(1);
  const crumbs = parts.map((p, i) => ({
    href: "/dashboard/" + parts.slice(0, i + 1).join("/"),
    label: i === 0 ? (TITLES[p] ?? p[0].toUpperCase() + p.slice(1)) : p === "new" ? "New" : "Details",
  }));
  // The page title is the section itself on a top-level page, so Overview is just "Overview".
  const trail = crumbs.length ? crumbs : [{ href: "/dashboard", label: "Overview" }];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === trail.length - 1 ? <BreadcrumbPage>{c.label}</BreadcrumbPage> : <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
