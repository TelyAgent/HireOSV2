import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FinalCriterionDto {
  @IsString()
  name!: string;

  @IsNumber()
  max!: number;

  @IsNumber()
  ai!: number;

  @IsNumber()
  human!: number;

  @IsOptional()
  @IsBoolean()
  overridden?: boolean;

  @IsOptional()
  @IsString()
  overrideReason?: string;
}

export class FinalizeEvaluationDto {
  @IsNumber()
  overall!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalCriterionDto)
  criteria!: FinalCriterionDto[];

  /**
   * Ignored (#134): who finalized is always the signed-in caller (or the user a trusted service acts for), never a
   * name sent in the body. Still accepted so older clients that send it keep working.
   */
  @IsOptional()
  @IsString()
  finalizedBy?: string;

  /** The round to finalize (#48); defaults to the latest submitted round. */
  @IsOptional()
  @IsString()
  invitationId?: string;
}

export class ReleaseResultDto {
  @IsNumber()
  overall!: number;

  @IsBoolean()
  showScore!: boolean;

  @IsString()
  outcomeText!: string;

  @IsString()
  feedbackText!: string;

  @IsString()
  nextStepText!: string;

  /** The round to release (#48); defaults to the latest submitted round. */
  @IsOptional()
  @IsString()
  invitationId?: string;
}
