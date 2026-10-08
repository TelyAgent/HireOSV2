import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateQuestionDto {
  @IsString()
  jobTitle!: string;

  @IsOptional()
  @IsString()
  jdText?: string;

  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  focusBrief!: string;

  @IsOptional()
  @IsIn(['zh', 'en'])
  lang?: 'zh' | 'en';
}

export class ExtractCompetenciesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  prompt!: string;

  @IsOptional()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsIn(['zh', 'en'])
  lang?: 'zh' | 'en';
}
