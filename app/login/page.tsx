import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

const REASON_COPY: Record<string, string> = {
  missing_profile:
    "You signed in to Supabase, but there is no matching row in public.profiles for your user id. Run the SQL migrations, then add or upsert a profile (role admin, active true) or run npm run seed:dev.",
  inactive_profile:
    "Your profile exists but active is false. In Supabase Table editor → profiles, set active to true for your user.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.reason;
  const reason = typeof raw === "string" ? raw : undefined;
  const reasonText = reason ? REASON_COPY[reason] : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md border-burgundy/15 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-serif text-2xl text-primary">Thagai CRM</CardTitle>
          <CardDescription className="text-muted-foreground">
            Team sign-in · internal use only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reasonText ? (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {reasonText}
            </p>
          ) : null}
          <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            Accounts are not created on this screen. Your first user must be added in{" "}
            <strong className="text-foreground">Supabase → Authentication → Users</strong>{" "}
            (Add user, set email + password). Then open{" "}
            <strong className="text-foreground">Table editor → profiles</strong> for that user
            and set <strong className="text-foreground">role</strong> to{" "}
            <code className="text-foreground">admin</code> and{" "}
            <strong className="text-foreground">active</strong> to true. There is no seeded admin
            in the repo — see <code className="text-foreground">CRM_SETUP.md</code>. For a one-shot
            dev setup use <code className="text-foreground">npm run seed:dev</code> after
            migrations.
          </p>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
