import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Mirrors the payload shape hireos-screening-backend's decisions.service.ts already builds for the
 * `candidate.advanced_to_interview` outbox event (see its "move_to_interview" branch) — the new
 * `candidate.assessment_requested` event this intake endpoint receives uses the same field set, since
 * both are "a screening decision handed a candidate+job off to another subsystem" events.
 */
export class ScreeningHandoffDto {
  @IsString()
  coreJobId!: string;

  @IsString()
  coreCandidateId!: string;

  @IsString()
  jobTitle!: string;

  @IsOptional()
  @IsString()
  jobDepartment?: string;

  @IsOptional()
  @IsString()
  jobLocation?: string;

  @IsOptional()
  @IsString()
  jobLevel?: string;

  @IsOptional()
  @IsString()
  jdText?: string;

  @IsString()
  candidateName!: string;

  @IsOptional()
  @IsString()
  candidateEmail?: string;

  @IsOptional()
  @IsString()
  candidatePhone?: string;

  @IsOptional()
  @IsString()
  coreMaterialId?: string;

  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  matchScore?: number;

  @IsOptional()
  @IsString()
  matchRecommendation?: string;
}
