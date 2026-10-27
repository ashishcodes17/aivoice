import { Suspense } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Onboarding } from "@/components/dashboard/onboarding";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSession } from "@/lib/dashboard";
import { rupees } from "@/lib/format";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-svh flex-1" aria-busy>
      <div className="hidden w-64 shrink-0 border-r bg-sidebar md:block" />
      <div className="flex-1" />
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const { supabase, user, org } = await getSession();
  if (!org) return <Onboarding />;

  const { data: bal } = await supabase
    .from("wallet_balances")
    .select("balance_paise")
    .eq("org_id", org.id)
    .maybeSingle();

  return (
    <SidebarProvider>
      <AppSidebar orgName={org.name} email={user.email ?? ""} balance={rupees(Number(bal?.balance_paise ?? 0))} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
