"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inviteTeamMember, setUserActive } from "@/lib/actions/admin-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  active: boolean;
  created_at: string;
};

export function TeamUsersAdmin({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const fd = new FormData(form);
    const r = await inviteTeamMember(fd);
    setPending(false);
    if (r.error) toast.error(r.error);
    else {
      toast.success("User created");
      form.reset();
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Invite user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="operations"
              >
                <option value="admin">Admin</option>
                <option value="operations">Operations</option>
                <option value="sales">Sales</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="md:col-span-2 w-fit bg-accent text-accent-foreground"
            >
              {pending ? "Creating…" : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="rounded-xl border border-border/80 bg-card divide-y">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {u.role}
              </Badge>
              <Badge variant={u.active ? "secondary" : "destructive"}>
                {u.active ? "Active" : "Inactive"}
              </Badge>
              {u.id !== currentUserId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const r = await setUserActive(u.id, !u.active);
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success("Updated");
                      router.refresh();
                    }
                  }}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
