#!/usr/bin/env python3
"""Rotate PGCRYPTO_KEY — re-encrypts all PII columns with a new key.

Usage:
    rotate_pgcrypto_key.py <DATABASE_URL> <OLD_KEY> <NEW_KEY>

Or via environment variables:
    CLINICAL_DATABASE_URL, OLD_PGCRYPTO_KEY, NEW_PGCRYPTO_KEY

Runs everything in a single transaction — rolls back on any error.
"""
import asyncio
import os
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# table → list of encrypted columns
TABLES_COLUMNS = [
    ("clients", ["full_name", "email", "phone"]),
    ("sessions", ["notes"]),
    ("users", ["full_name", "email", "totp_secret"]),
]


async def rotate(db_url: str, old_key: str, new_key: str) -> None:
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine)

    try:
        async with session_factory() as db:
            async with db.begin():
                for table, columns in TABLES_COLUMNS:
                    for col in columns:
                        sql = text(f"""
                            UPDATE {table}
                            SET {col} = pgp_sym_encrypt(
                                pgp_sym_decrypt({col}::bytea, :old_key),
                                :new_key
                            )
                            WHERE {col} IS NOT NULL
                        """)
                        result = await db.execute(
                            sql, {"old_key": old_key, "new_key": new_key}
                        )
                        print(f"Rotated {result.rowcount} rows in {table}.{col}")

        print("\nDone. Update CLINICAL_DB_PGCRYPTO_KEY in .env to the new key.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) == 4:
        _db_url, _old_key, _new_key = sys.argv[1], sys.argv[2], sys.argv[3]
    else:
        _db_url = os.environ.get("CLINICAL_DATABASE_URL", "")
        _old_key = os.environ.get("OLD_PGCRYPTO_KEY", "")
        _new_key = os.environ.get("NEW_PGCRYPTO_KEY", "")
        if not all([_db_url, _old_key, _new_key]):
            print(
                "Usage: rotate_pgcrypto_key.py <DATABASE_URL> <OLD_KEY> <NEW_KEY>\n"
                "  Or set env vars: CLINICAL_DATABASE_URL, OLD_PGCRYPTO_KEY, NEW_PGCRYPTO_KEY"
            )
            sys.exit(1)

    asyncio.run(rotate(_db_url, _old_key, _new_key))
