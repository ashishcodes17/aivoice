"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotIcon, LayoutDashboardIcon, LogOutIcon, PhoneCallIcon, PhoneIcon, WalletIcon } from "lucide-react";
import { LogoMark } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/dashboard/actions";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon, exact: true },
  { href: "/dashboard/agents", label: "Agents", icon: BotIcon },
  { href: "/dashboard/numbers", label: "Numbers", icon: PhoneIcon },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCallIcon },
  { href: "/dashboard/wallet", label: "Wallet", icon: WalletIcon },
];

export function AppSidebar({ orgName, email, balance }: { orgName: string; email: string; balance: string }) {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="font-heading font-semibold text-[15px] tracking-tight">Lynksy</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{orgName}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton isActive={active} render={<Link href={href} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <Link
          href="/dashboard/wallet"
          className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 transition-colors hover:bg-accent/50"
        >
          <span className="text-muted-foreground text-xs">Wallet</span>
          <span className="font-medium text-sm tabular-nums">{balance}</span>
        </Link>
        <SidebarSeparator className="mx-0" />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="min-w-0 truncate text-muted-foreground text-xs" title={email}>
            {email}
          </span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon-xs" aria-label="Sign out">
              <LogOutIcon />
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
