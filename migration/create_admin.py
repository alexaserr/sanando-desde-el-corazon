"""
Crea el usuario admin de prueba en clinical_db.

Credenciales:
  email:    admin@sdc.dev
  password: SdcAdmin2026!
  role:     admin

PII (email, full_name) cifrado con pgp_sym_encrypt — misma clave que usa
el auth router para pgp_sym_decrypt en el login.

Idempotente: no inserta si ya existe un usuario con ese email.
Uso: python create_admin.py
"""

import sys

import bcrypt
import psycopg
from config import settings

ADMIN_EMAIL = "admin@sdc.dev"
ADMIN_FULL_NAME = "Admin SDC"
ADMIN_PASSWORD = "SdcAdmin2026!"


def admin_exists(conn: psycopg.Connection, pgkey: str) -> bool:  # type: ignore[type-arg]
    """Devuelve True si ya existe un usuario con email=ADMIN_EMAIL."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id FROM users
            WHERE pgp_sym_decrypt(email::bytea, %s) = %s
              AND deleted_at IS NULL
            LIMIT 1
            """,
            (pgkey, ADMIN_EMAIL),
        )
        return cur.fetchone() is not None


def create_admin(conn: psycopg.Connection, pgkey: str) -> None:
    """Inserta el usuario admin con PII cifrado y password hasheado."""
    hashed_pw = bcrypt.hashpw(
        ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (
                id,
                email,
                full_name,
                hashed_password,
                role,
                is_active,
                totp_enabled,
                totp_secret
            ) VALUES (
                gen_random_uuid(),
                pgp_sym_encrypt(%s, %s),
                pgp_sym_encrypt(%s, %s),
                %s,
                'admin'::user_role_enum,
                TRUE,
                FALSE,
                NULL
            )
            """,
            (
                ADMIN_EMAIL,
                pgkey,
                ADMIN_FULL_NAME,
                pgkey,
                hashed_pw,
            ),
        )


def main() -> None:
    db_url = settings.CLINICAL_DATABASE_URL.replace(
        "postgresql+psycopg://", "postgresql://"
    )
    pgkey = settings.CLINICAL_DB_PGCRYPTO_KEY

    print("Conectando a clinical_db…")
    with psycopg.connect(db_url) as conn:
        if admin_exists(conn, pgkey):
            print(f"— Usuario {ADMIN_EMAIL!r} ya existe — no se insertó nada.")
            return

        create_admin(conn, pgkey)
        conn.commit()

    print(f"✓ Admin creado: {ADMIN_EMAIL}")
    print(f"  full_name : {ADMIN_FULL_NAME}")
    print("  role      : admin")
    print("  totp      : deshabilitado")
    print("\nPrueba el login:")
    print("  curl -X POST http://localhost:8001/api/v1/auth/login \\")
    print("    -H 'Content-Type: application/json' \\")
    print(f'    -d \'{{"email": "{ADMIN_EMAIL}", "password": "{ADMIN_PASSWORD}"}}\'')


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)
