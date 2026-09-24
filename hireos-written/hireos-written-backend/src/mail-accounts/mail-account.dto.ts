import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

const PROVIDERS = ['gmail', 'outlook', 'qq', '163', '126', 'custom'] as const;

export class CreateMailAccountDto {
  @IsString()
  name!: string;

  @IsIn(PROVIDERS)
  provider!: (typeof PROVIDERS)[number];

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;
}

export class UpdateMailAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PROVIDERS)
  provider?: (typeof PROVIDERS)[number];

  @IsOptional()
  @IsEmail()
  email?: string;

  // Optional on update -- omitted means "keep the existing password" (mirrors hireos-screening's
  // own update semantics, since re-typing an app password every edit is bad UX).
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;
}

export class SetMailAccountEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class TestMailAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  smtpSecure!: boolean;
}
