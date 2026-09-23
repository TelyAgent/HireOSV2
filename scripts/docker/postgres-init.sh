#!/bin/sh
# Runs once, only against a fresh (empty) postgres data volume, via
# docker-entrypoint-initdb.d. Creates one database per subsystem; Core
# Record's `core_record` schema inside hireos_core_record is created by its
# own `prisma migrate deploy` on first boot, not here.
set -e

for db in hireos_interview hireos_screening hireos_core_record hireos_jd; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE "$db";
EOSQL
done
