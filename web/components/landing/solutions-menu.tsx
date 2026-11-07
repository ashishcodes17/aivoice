"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Menu, MenuLinkItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { solutions } from "@/lib/solutions";

export function SolutionsMenu() {
  return (
    <Menu>
      <MenuTrigger className="flex items-center gap-1 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground data-[popup-open]:text-foreground">
        Solutions <ChevronDownIcon className="size-3.5" />
      </MenuTrigger>
      <MenuPopup align="start" sideOffset={14} className="w-72">
        {solutions.map((s) => (
          <MenuLinkItem key={s.slug} render={<Link href={`/solutions/${s.slug}`} />} className="items-start gap-3 py-2">
            <s.icon className="mt-0.5 text-primary" />
            <span className="grid leading-tight">
              <span className="font-medium">{s.name}</span>
              <span className="mt-0.5 text-muted-foreground text-xs">{s.summary}</span>
            </span>
          </MenuLinkItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
