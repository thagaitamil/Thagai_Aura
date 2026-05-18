import { redirect } from "next/navigation";
import { getSessionProfile, isAdmin } from "@/lib/auth/session";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPermissionsPage() {
  const { profile } = await getSessionProfile();
  if (!profile || !isAdmin(profile.role)) redirect("/dashboard");

  const roles = ["admin", "operations", "sales", "viewer"] as const;

  const permissions: {
    action: string;
    description: string;
    allowed: Record<string, boolean>;
  }[] = [
    {
      action: "View supply profiles",
      description: "See the supply list and individual profiles",
      allowed: { admin: true, operations: true, sales: true, viewer: true },
    },
    {
      action: "Add / edit supply",
      description: "Create and update caretaker/nurse profiles",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "Upload supply documents",
      description: "Upload Aadhaar, medical certs, etc.",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "Add supply activity log",
      description: "Log activities on supply profiles",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "Add / edit references",
      description: "Add reference contacts and toggle verification",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "Add risk flags",
      description: "Flag and resolve risk markers on supply",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "View leads",
      description: "See the leads list (sales sees only assigned leads)",
      allowed: { admin: true, operations: true, sales: true, viewer: true },
    },
    {
      action: "Add / edit leads",
      description: "Create and update lead profiles",
      allowed: { admin: true, operations: true, sales: true, viewer: false },
    },
    {
      action: "Upload lead documents",
      description: "Upload agreements, ID proofs, etc.",
      allowed: { admin: true, operations: true, sales: true, viewer: false },
    },
    {
      action: "Log lead activity",
      description: "Add conversation notes and follow-ups",
      allowed: { admin: true, operations: true, sales: true, viewer: false },
    },
    {
      action: "Supply ↔ Lead mapping",
      description: "Set priority supply for a lead, update trial status",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
    {
      action: "View dashboard",
      description: "See master dashboard metrics",
      allowed: { admin: true, operations: true, sales: true, viewer: true },
    },
    {
      action: "Manage team users",
      description: "Create / deactivate user accounts",
      allowed: { admin: true, operations: false, sales: false, viewer: false },
    },
    {
      action: "Manage area tags",
      description: "Add / remove area options used in profiles",
      allowed: { admin: true, operations: true, sales: false, viewer: false },
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Role permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of what each role can do. Permissions are enforced server-side and cannot be changed from here — contact your developer to modify them.
        </p>
      </div>

      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">Permission matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/80 bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-1/2">Action</th>
                  {roles.map((r) => (
                    <th key={r} className="text-center px-4 py-3 font-medium text-muted-foreground capitalize">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {permissions.map((perm) => (
                  <tr key={perm.action} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{perm.action}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{perm.description}</div>
                    </td>
                    {roles.map((r) => (
                      <td key={r} className="px-4 py-3 text-center">
                        {perm.allowed[r] ? (
                          <Check className="size-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="size-4 text-muted-foreground/40 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">Role descriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { role: "Admin", desc: "Full access to everything. Can create and manage user accounts." },
            { role: "Operations", desc: "Can manage supply profiles, activities, documents, and references. Can view and work on leads. Cannot manage users." },
            { role: "Sales", desc: "Can create and update leads. Sees only their own assigned leads. Cannot touch supply data." },
            { role: "Viewer", desc: "Read-only access to leads, supply, and dashboard. Cannot create or edit anything." },
          ].map(({ role, desc }) => (
            <div key={role} className="flex gap-3">
              <span className="shrink-0 font-medium w-24">{role}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
