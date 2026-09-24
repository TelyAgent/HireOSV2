/** Role templates (Templates page) — ported from the prototype. */
import { daysAgo } from "../../lib/format";
import type { Template } from "../types";

export const TEMPLATES: Template[] = [
  { id: "tpl-1", name: "Engineering — Backend", updatedAt: daysAgo(15), usedBy: 6 },
  { id: "tpl-2", name: "People Operations — HR Lead", updatedAt: daysAgo(40), usedBy: 2 },
  { id: "tpl-3", name: "Customer Success — Lead", updatedAt: daysAgo(90), usedBy: 3 },
];
