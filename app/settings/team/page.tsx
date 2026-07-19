import { getSessionUser, isAdmin } from "@/lib/auth";
import { getRoleDefinitions } from "@/lib/data/permissions-store";
import { listTeamMembers } from "@/lib/team-directory";
import TeamPermissionsClient from "@/components/permissions/TeamPermissionsClient";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function TeamPermissionsPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return <div className="ob-screen"><PageHeader eyebrow="Administration" title="Team & Permissions" /><div className="mx-auto max-w-[560px] px-6 pt-20 text-center"><div className="font-display text-2xl">Admins only.</div><p className="mt-2 text-sm text-charcoal">Only an existing Admin can manage people, roles and permission overrides.</p></div></div>;
  const [members, roles] = await Promise.all([listTeamMembers(), getRoleDefinitions()]);
  return <TeamPermissionsClient initialMembers={members} initialRoles={roles} currentUserId={user.id} />;
}
