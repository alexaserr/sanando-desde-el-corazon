"""
Seed de catálogos — clinical_db.

Inserta datos iniciales en:
  - therapy_types     (5 terapias)
  - chakra_positions  (7 chakras)
  - energy_dimensions (9 dimensiones activas)

Idempotente: ON CONFLICT DO NOTHING en cada tabla.
Uso: python seed_catalogs.py
"""
import sys

import psycopg

from config import settings

# ── Datos a sembrar ───────────────────────────────────────────

THERAPY_TYPES: list[tuple[str, str]] = [
    ("Sanación Energética",  "Sanación mediante transferencia de energía vital."),
    ("Lectura de Aura",      "Lectura e interpretación del campo áurico del cliente."),
    ("Limpieza Energética",  "Limpieza y liberación de cargas energéticas negativas."),
    ("Terapia LNT",          "Liberación de memorias celulares y patrones negativos transgeneracionales."),
    ("Sanación a Distancia", "Sesión de sanación energética realizada de forma remota."),
]

# (position, name, color)
CHAKRA_POSITIONS: list[tuple[int, str, str]] = [
    (1, "Raíz",        "Rojo"),
    (2, "Sacro",       "Naranja"),
    (3, "Plexo Solar", "Amarillo"),
    (4, "Corazón",     "Verde"),
    (5, "Garganta",    "Azul"),
    (6, "Tercer Ojo",  "Índigo"),
    (7, "Corona",      "Violeta"),
]

# (name, display_order)
ENERGY_DIMENSIONS: list[tuple[str, int]] = [
    ("Vibración",          1),
    ("Masculina",          2),
    ("Femenina",           3),
    ("Física",             4),
    ("Psíquica",           5),
    ("Abundancia",         6),
    ("Prosperidad",        7),
    ("Relación c/Dinero",  8),
    ("Polución",           9),
]


# ── Helpers ───────────────────────────────────────────────────

def seed_therapy_types(conn: psycopg.Connection) -> int:  # type: ignore[type-arg]
    inserted = 0
    with conn.cursor() as cur:
        for name, description in THERAPY_TYPES:
            cur.execute(
                """
                INSERT INTO therapy_types (id, name, description)
                VALUES (gen_random_uuid(), %s, %s)
                ON CONFLICT (name) DO NOTHING
                """,
                (name, description),
            )
            if cur.rowcount:
                print(f"  [therapy_types] ✓ {name!r}")
                inserted += 1
            else:
                print(f"  [therapy_types] — ya existe: {name!r}")
    return inserted


def seed_chakra_positions(conn: psycopg.Connection) -> int:  # type: ignore[type-arg]
    inserted = 0
    with conn.cursor() as cur:
        for position, name, color in CHAKRA_POSITIONS:
            cur.execute(
                """
                INSERT INTO chakra_positions (id, position, name, color)
                VALUES (gen_random_uuid(), %s, %s, %s)
                ON CONFLICT (position) DO NOTHING
                """,
                (position, name, color),
            )
            if cur.rowcount:
                print(f"  [chakra_positions] ✓ {position} — {name}")
                inserted += 1
            else:
                print(f"  [chakra_positions] — ya existe: {position} — {name}")
    return inserted


def seed_energy_dimensions(conn: psycopg.Connection) -> int:  # type: ignore[type-arg]
    inserted = 0
    with conn.cursor() as cur:
        for name, order in ENERGY_DIMENSIONS:
            cur.execute(
                """
                INSERT INTO energy_dimensions (id, name, display_order, is_active)
                VALUES (gen_random_uuid(), %s, %s, TRUE)
                ON CONFLICT (name) DO NOTHING
                """,
                (name, order),
            )
            if cur.rowcount:
                print(f"  [energy_dimensions] ✓ {order}. {name}")
                inserted += 1
            else:
                print(f"  [energy_dimensions] — ya existe: {name}")
    return inserted


# ── Main ──────────────────────────────────────────────────────

def main() -> None:
    db_url = settings.CLINICAL_DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    print(f"Conectando a clinical_db…")

    with psycopg.connect(db_url) as conn:
        print("\n── therapy_types ──────────────────────────")
        n_therapy = seed_therapy_types(conn)

        print("\n── chakra_positions ───────────────────────")
        n_chakra = seed_chakra_positions(conn)

        print("\n── energy_dimensions ──────────────────────")
        n_dim = seed_energy_dimensions(conn)

        conn.commit()

    print(f"\n✓ Seed completo: {n_therapy} terapias, {n_chakra} chakras, {n_dim} dimensiones insertadas.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\n✗ Error: {exc}", file=sys.stderr)
        sys.exit(1)
