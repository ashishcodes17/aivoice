import { LogoMark } from "@/components/landing/logo";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createOrganization, signOut } from "@/app/dashboard/actions";

export function Onboarding() {
  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6">
      <LogoMark className="size-10" />
      <h1 className="mt-8 font-heading font-semibold text-3xl tracking-[-0.035em]">Create your organization</h1>
      <p className="mt-2 max-w-sm text-center text-muted-foreground text-sm leading-6">
        Your agents, numbers and calls live inside an organization. You can invite teammates later.
      </p>
      <form action={createOrganization} className="mt-8 w-full max-w-sm space-y-5">
        <Field>
          <FieldLabel>Company name</FieldLabel>
          <Input name="name" size="lg" required autoFocus placeholder="Acme Inc." />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Continue
        </Button>
      </form>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="link" size="sm" className="text-muted-foreground">
          Sign out
        </Button>
      </form>
    </div>
  );
}
