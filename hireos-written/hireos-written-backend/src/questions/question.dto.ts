import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class CompetencyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  fraction!: number;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsArray()
  @IsString({ each: true })
  roles!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetencyDto)
  competencies!: CompetencyDto[];

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estMinutes?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['published', 'draft_review', 'internal_only', 'concept'])
  status?: string;

  @IsOptional()
  @IsString()
  author?: string;
}

/** Every field optional -- the bank page toggles `favorite` alone; the edit drawer sends content. */
export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetencyDto)
  competencies?: CompetencyDto[];

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
