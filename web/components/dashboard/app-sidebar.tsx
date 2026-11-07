"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLinesIcon,
  BotIcon,
  BarChart3Icon,
  ChevronsUpDownIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  PhoneIcon,
  WalletIcon,
} from "lucide-react";
import { LogoMark } from "@/components/landing/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuLinkItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/dashboard/actions";

type Item = { href: string; label: string; icon: typeof BotIcon; exact?: boolean };

export const NAV: { label: string; items: Item[] }[] = [
  {
    label: "Build",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon, exact: true },
      { href: "/dashboard/agents", label: "Agents", icon: BotIcon },
      { href: "/dashboard/numbers", label: "Numbers", icon: PhoneIcon },
      { href: "/dashboard/voices", label: "Voices", icon: AudioLinesIcon },
    ],
  },
  {
    label: "Conversations",
    items: [
      { href: "/dashboard/calls", label: "Calls", icon: PhoneCallIcon },
      { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircleIcon },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/usage", label: "Usage & reports", icon: BarChart3Icon },
      { href: "/dashboard/wallet", label: "Wallet", icon: WalletIcon },
    ],
  },
];

export function AppSidebar({ orgName, email, balance }: { orgName: string; email: string; balance: string }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const initials = (email || orgName).slice(0, 2).toUpperCase();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <LogoMark className="size-8 shrink-0" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-heading font-semibold tracking-tight">Lynksy</span>
                <span className="truncate text-muted-foreground text-xs">{orgName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact ? pathname === href : pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} />}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                      {href === "/dashboard/wallet" && <SidebarMenuBadge className="tabular-nums">{balance}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Menu>
              <MenuTrigger render={<SidebarMenuButton size="lg" className="data-[popup-open]:bg-sidebar-accent" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{orgName}</span>
                  <span className="truncate text-muted-foreground text-xs">{email}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </MenuTrigger>
              <MenuPopup side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="min-w-56">
                <MenuGroup>
                  <MenuGroupLabel className="truncate">{email}</MenuGroupLabel>
                </MenuGroup>
                <MenuSeparator />
                <MenuLinkItem render={<Link href="/dashboard/wallet" />}>
                  <WalletIcon /> Wallet · {balance}
                </MenuLinkItem>
                <MenuSeparator />
                <MenuItem variant="destructive" onClick={() => signOut()}>
                  <LogOutIcon /> Sign out
                </MenuItem>
              </MenuPopup>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
