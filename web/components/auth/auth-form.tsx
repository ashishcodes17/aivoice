"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, MailCheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { createClient } from "@/lib/supabase/browser";

type Mode = "login" | "signup";

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to manage your voice agents.",
    submit: "Sign in",
    switchText: "New to Lynksy?",
    switchLink: "Create an account",
    switchHref: "/signup",
    passwordAutocomplete: "current-password",
  },
  signup: {
    title: "Create your account",
    subtitle: "Start building voice agents in minutes.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login",
    passwordAutocomplete: "new-password",
  },
} as const;

function friendlyError(message: string, mode: Mode) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password") && m.includes("least")) return "Use a password with at least 8 characters.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("email not confirmed")) return "Confirm your email first, then sign in.";
  return mode === "login" ? message : `Could not create your account: ${message}`;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const c = copy[mode];
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(false);
        return setError(friendlyError(error.message, mode));
      }
      if (!data.session) {
        setBusy(false);
        return setNotice("Check your email for a confirmation link, then sign in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        return setError(friendlyError(error.message, mode));
      }
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-heading font-semibold text-3xl tracking-[-0.035em]">{c.title}</h1>
      <p className="mt-2 text-muted-foreground text-sm leading-6">{c.subtitle}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate={false}>
        {error && (
          <Alert variant="error">
            <AlertCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert variant="success">
            <MailCheckIcon />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            type="email"
            size="lg"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
          />
        </Field>

        <Field>
          <FieldLabel>Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              name="password"
              type={show ? "text" : "password"}
              size="lg"
              required
              minLength={8}
              autoComplete={c.passwordAutocomplete}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            />
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {c.submit}
        </Button>
      </form>

      <p className="mt-8 text-center text-muted-foreground text-sm">
        {c.switchText}{" "}
        <Link href={c.switchHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          {c.switchLink}
        </Link>
      </p>
    </div>
  );
}
