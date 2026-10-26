import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createOrganization, signOut } from "./actions";

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  // RLS limits this to orgs the signed-in user belongs to.
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!org) {
    return (
      <form action={createOrganization} className="max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Create your organization</h1>
        <input
          name="name"
          required
          placeholder="Company name"
          className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
          Create
        </button>
      </form>
    );
  }

  const [balance, agents, calls] = await Promise.all([
    supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle(),
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("org_id", org.id),
  ]);

  const stats = [
    { label: "Wallet balance", value: rupees(Number(balance.data?.balance_paise ?? 0)) },
    { label: "Agents", value: String(agents.count ?? 0) },
    { label: "Calls", value: String(calls.count ?? 0) },
  ];

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-zinc-500">{user.user?.email}</p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-zinc-500 hover:underline">Sign out</button>
        </form>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </section>
    </>
  );
}
