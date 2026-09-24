export type PersonId = "emma" | "daniel" | "morgan";

export interface Person {
  id: PersonId;
  name: string;
  role: "HR" | "HM" | "Admin";
  title: string;
  email: string;
  color: string;
  initials: string;
}

export const PEOPLE: Record<PersonId, Person> = {
  emma: {
    id: "emma",
    name: "Emma Wilson",
    role: "HR",
    title: "Senior Recruiter",
    email: "emma.wilson@hireos.demo",
    color: "#1a73e8",
    initials: "EW",
  },
  daniel: {
    id: "daniel",
    name: "Daniel Park",
    role: "HM",
    title: "Hiring Manager, Platform Engineering",
    email: "daniel.park@hireos.demo",
    color: "#188038",
    initials: "DP",
  },
  morgan: {
    id: "morgan",
    name: "Morgan Reed",
    role: "Admin",
    title: "People Ops Admin",
    email: "morgan.reed@hireos.demo",
    color: "#8430ce",
    initials: "MR",
  },
};

export function getPerson(id: PersonId | string | null | undefined): Person | null {
  if (!id) return null;
  return (PEOPLE as Record<string, Person>)[id] ?? null;
}

export function initialsOf(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
