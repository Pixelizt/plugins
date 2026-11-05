// Dashboard roles and their order (pure, browser-safe). Kit code: do not edit in a client project.
export type Role = "admin" | "editor" | "demo";
const RANK: Record<Role, number> = { demo: 0, editor: 1, admin: 2 };

export const isRole = (role: unknown): role is Role => typeof role === "string" && Object.hasOwn(RANK, role);

/** True when `role` is a known role at or above `min`. Unknown or missing roles never pass. */
export const roleAtLeast = (role: string | undefined, min: Role) => isRole(role) && RANK[role] >= RANK[min];
