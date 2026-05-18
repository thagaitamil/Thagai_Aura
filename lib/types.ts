export type ProfileRole = "admin" | "operations" | "sales" | "viewer";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: ProfileRole;
  active: boolean;
  created_at: string;
};
