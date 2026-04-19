/**
 * capabilities – centraliserar vilka förmågor som finns, vilka default-
 * värden varje roll har, och slutlig resolvering med per-medlems-overrides.
 *
 * Används av useCapabilities-hooken och admin-editorn. Håller en single
 * source-of-truth så listan kan utökas utan att alla UI-platser måste
 * ändras samtidigt.
 */

export type Capability =
  | "edit_plans"
  | "share_plans"
  | "manage_inventory"
  | "manage_teams"
  | "manage_halls"
  | "invite_members"
  | "manage_members";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "edit_plans",
  "share_plans",
  "manage_inventory",
  "manage_teams",
  "manage_halls",
  "invite_members",
  "manage_members",
] as const;

export const CAPABILITY_LABEL: Record<Capability, string> = {
  edit_plans:       "Redigera pass",
  share_plans:      "Dela pass",
  manage_inventory: "Flytta redskap",
  manage_teams:     "Skapa/ändra lag",
  manage_halls:     "Skapa/ändra hallar",
  invite_members:   "Bjuda in",
  manage_members:   "Hantera medlemmar",
};

export const CAPABILITY_DESCRIPTION: Record<Capability, string> = {
  edit_plans:       "Spara och ändra klubbens/lagets pass",
  share_plans:      "Dela pass med klubb, lag eller individer",
  manage_inventory: "Flytta redskap mellan hallar",
  manage_teams:     "Skapa nya lag och ändra lag-info",
  manage_halls:     "Skapa nya hallar och ändra mått",
  invite_members:   "Skicka inbjudningar via e-post",
  manage_members:   "Ändra roller och ta bort medlemmar",
};

export type MemberRole = "admin" | "coach" | "member";

/**
 * Roll-default-matris. Admin har allt; tränare kan driftsaker; medlem bara
 * läser. Kan åsidosättas per user via member_capabilities.overrides.
 */
export const ROLE_DEFAULTS: Record<MemberRole, Record<Capability, boolean>> = {
  admin: {
    edit_plans:       true,
    share_plans:      true,
    manage_inventory: true,
    manage_teams:     true,
    manage_halls:     true,
    invite_members:   true,
    manage_members:   true,
  },
  coach: {
    edit_plans:       true,
    share_plans:      true,
    manage_inventory: true,
    manage_teams:     false,
    manage_halls:     false,
    invite_members:   true,
    manage_members:   false,
  },
  member: {
    edit_plans:       false,
    share_plans:      false,
    manage_inventory: false,
    manage_teams:     false,
    manage_halls:     false,
    invite_members:   false,
    manage_members:   false,
  },
};

export type CapabilitySet = Record<Capability, boolean>;

/** Slår ihop roll-default med overrides (true/false per nyckel). */
export function resolveCapabilities(
  role: MemberRole,
  overrides: Partial<Record<Capability, boolean>> | null,
): CapabilitySet {
  const base = { ...ROLE_DEFAULTS[role] };
  if (!overrides) return base;
  for (const key of ALL_CAPABILITIES) {
    const v = overrides[key];
    if (typeof v === "boolean") base[key] = v;
  }
  return base;
}

/** Tom cap-set där inget är tillåtet (används när user ej är medlem). */
export const NO_CAPABILITIES: CapabilitySet = {
  edit_plans:       false,
  share_plans:      false,
  manage_inventory: false,
  manage_teams:     false,
  manage_halls:     false,
  invite_members:   false,
  manage_members:   false,
};
