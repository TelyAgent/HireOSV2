import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsIn, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class CompetencySnapshotDto {
  @IsString()
  name!: string;

  @IsNumber()
  fraction!: number;
}

export class QuestionSnapshotDto {
  @IsString()
  questionId!: string;

  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsString()
  prompt!: string;

  // Carried along so the auto-evaluator (see AiEvaluatorService) can score against the exact same
  // weighted rubric the question was designed with, without depending on the originating PlanItem
  // still existing by the time the candidate replies (see PlanPage's orphaned-invitation recovery
  // for why that assumption doesn't always hold).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetencySnapshotDto)
  competencies?: CompetencySnapshotDto[];
}

export class CreateInvitationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionSnapshotDto)
  questions!: QuestionSnapshotDto[];

  @IsIn(['timed', 'deadline_only'])
  mode!: 'timed' | 'deadline_only';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsISO8601()
  deadline!: string;

  @IsIn(['score_and_summary', 'summary_only'])
  disclosurePolicy!: 'score_and_summary' | 'summary_only';

  @IsEmail()
  recipientEmail!: string;
}
