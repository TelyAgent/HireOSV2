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

  @IsOptional()
  @IsString()
  finalizedBy?: string;
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
}
