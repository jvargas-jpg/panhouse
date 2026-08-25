#!/bin/bash
# Crea la base de datos "<POSTGRES_DB>_test" usada por la suite de tests
# (server/db + tests/globalSetup.ts la migran automáticamente).
# Solo corre una vez, la primera vez que se crea el volumen de Postgres.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "${POSTGRES_DB}_test";
EOSQL
