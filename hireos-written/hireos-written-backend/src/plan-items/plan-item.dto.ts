import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class CompetencyDto {
  @IsString()
  name!: string;

  @IsNumber()
  fraction!: number;
}

export class CreatePlanItemDto {
  @IsIn(['required', 'optional'])
  kind!: 'required' | 'optional';

  @IsString()
  questionCode!: string;

  @IsString()
  questionTitle!: string;

  @IsString()
  questionPrompt!: string;

  @IsOptional()
  @IsString()
  customPrompt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetencyDto)
  competencies?: CompetencyDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];
}

export class UpdatePlanItemDto {
  @IsOptional()
  @IsString()
  customPrompt?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
