-- When the user chose `locale` themselves (#233). Null means it is still the default.
ALTER TABLE "User" ADD COLUMN     "localeSetAt" TIMESTAMP(3);
