import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEmail, IsIn, IsISO8601, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class QuestionSnapshotDto {
  @IsString()
  questionId!: string;

  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsString()
  prompt!: string;
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
