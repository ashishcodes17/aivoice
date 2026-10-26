import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">AI Voice Calling Platform</h1>
      <p className="max-w-md text-zinc-500">Build voice agents that answer and make phone calls in Indian languages.</p>
      <Link href="/login" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
        Get started
      </Link>
    </main>
  );
}
