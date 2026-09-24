import { daysAgo } from "../../lib/daysAgo";

export interface Assessment {
  status: "completed" | "not_administered";
  score?: number;
  scale?: number;
  completedAt?: string;
}

/** Downstream Assessment results, used only for the Compare "same stage" demo. */
export const ASSESSMENTS: Record<string, Assessment> = {
  "app-alex-a": { status: "completed", score: 78, scale: 100, completedAt: daysAgo(1) },
  "app-jordan-a": { status: "not_administered" },
  "app-casey-a": { status: "not_administered" },
  "app-riley-a": { status: "not_administered" },
  "app-morganb-a": { status: "not_administered" },
};
