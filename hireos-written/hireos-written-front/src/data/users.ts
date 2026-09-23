import type { UserId } from "../store/types";

export interface DemoUser {
  id: UserId;
  name: string;
  role: string;
  initials: string;
  note?: string;
}

export const USERS: Record<UserId, DemoUser> = {
  user_john: { id: "user_john", name: "John", role: "HR Head", initials: "J" },
  user_daniel: { id: "user_daniel", name: "Daniel Park", role: "Hiring Manager / Reviewer", initials: "DP" },
  user_morgan: { id: "user_morgan", name: "Morgan Reed", role: "Assessment Admin", initials: "MR" },
  user_sam: {
    id: "user_sam",
    name: "Sam",
    role: "Employee (no fixed HR/HM role)",
    initials: "S",
    note: "Startup Team Access demo — any valid employee, not an HR/HM/reviewer role.",
  },
};

export function getUser(id: UserId): DemoUser {
  return USERS[id];
}
