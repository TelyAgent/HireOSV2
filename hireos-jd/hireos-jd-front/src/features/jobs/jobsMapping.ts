import type { Job } from "../../data/types";
import type { CoreJobDto } from "./jobsApi";

/**
 * Maps a real Core Record job into the local `Job` shape. Core Record only has
 * title/team/location/employmentType/openings/status/version/createdBy — everything this app's Job
 * Library additionally shows (department, hiring manager, recruiter, approval/publication/activation
 * status, active role version, collaboration status) has no backend equivalent yet, so those fields
 * fall back to an already-present local value (e.g. one set by the Copilot creation flow) or a neutral
 * placeholder. `PersonChip`/`PersonAvatar` already render an empty id as "Unassigned", so leaving those
 * blank degrades gracefully rather than crashing or showing a fake name.
 */
export function coreJobToLocalJob(core: CoreJobDto, existing?: Job): Job {
  return {
    id: core.id,
    title: core.title,
    department: existing?.department ?? core.team ?? "—",
    team: core.team ?? existing?.team ?? "—",
    location: core.location ?? existing?.location ?? "—",
    employmentType: core.employmentType ?? existing?.employmentType ?? "—",
    workplaceType: existing?.workplaceType ?? "—",
    level: existing?.level ?? core.seniority ?? "—",
    priority: existing?.priority ?? "normal",
    headcount: core.openings ?? existing?.headcount ?? 1,
    hiringManager: existing?.hiringManager ?? "",
    recruiter: existing?.recruiter ?? "",
    owner: existing?.owner ?? core.createdBy ?? "",
    // Core Record's own status vocabulary (draft/open/paused/closed/archived) predates this app's
    // two-state simplification — anything that isn't "draft" there counts as published here.
    hiringStatus: core.status === "draft" ? "draft" : "published",
    activeRoleVersionRef: existing?.activeRoleVersionRef ?? null,
    collaborationStatus: existing?.collaborationStatus ?? "ready",
    draftRevision: core.version ?? existing?.draftRevision ?? 1,
    createdAt: core.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: core.updatedAt ?? existing?.updatedAt ?? new Date().toISOString(),
    approvalStatus: existing?.approvalStatus ?? "not_submitted",
    activationStatus: existing?.activationStatus ?? "not_requested",
    publicationStatus: existing?.publicationStatus ?? "not_published",
    story: existing?.story,
    lifecycleReason: existing?.lifecycleReason,
    qualityNote: existing?.qualityNote,
    duplicateOf: existing?.duplicateOf,
    possibleDuplicateOf: existing?.possibleDuplicateOf,
    sourceRef: existing?.sourceRef,
  };
}
