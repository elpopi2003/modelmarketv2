"""
Genera el ZIP de imágenes para el importador de ModelMarket a partir de ModelKitLibrary.

ModelKitLibrary guarda las portadas con nombres aleatorios (covers/002067c0d11c4eb1.jpg);
su base de datos relaciona cada maqueta (por su enlace de Scalemates) con su portada. Este
script cruza el Excel exportado con esa base de datos y crea un ZIP con cada imagen
renombrada como el importador espera: «Marca-Referencia.jpg».

Uso (Windows, con Python 3 y openpyxl):

    python scripts/modelkitlibrary-zip.py "C:\\Users\\yo\\Downloads\\coleccion.xlsx"

Opciones:
    --appdata DIR   carpeta de ModelKitLibrary (por defecto %APPDATA%\\ModelKitLibrary)
    --out FICHERO   ZIP de salida (por defecto, junto al Excel: <excel>-imagenes.zip)

Busca las maquetas en library.sqlite y en todas las copias de backups/ (la base actual a
veces tiene menos maquetas que la última copia). Abre todo en solo lectura: no modifica
nada de ModelKitLibrary.
"""

import argparse
import glob
import os
import re
import sqlite3
import sys
import zipfile

from openpyxl import load_workbook


def norm_header(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("ñ", "n").translate(str.maketrans("áéíóú", "aeiou")))


def safe_name(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-")


def covers_by_url(appdata):
    """scalemates_url -> nombre de fichero de portada, de la base actual y sus copias (la más nueva manda)."""
    dbs = glob.glob(os.path.join(appdata, "backups", "*.sqlite"))
    dbs.sort(key=os.path.getmtime)
    current = os.path.join(appdata, "library.sqlite")
    if os.path.exists(current):
        dbs.append(current)
    mapping = {}
    for path in dbs:
        try:
            db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            for url, image in db.execute(
                "SELECT scalemates_url, image_path FROM kits WHERE scalemates_url IS NOT NULL AND image_path IS NOT NULL"
            ):
                mapping[url] = image
            db.close()
        except sqlite3.Error as e:
            print(f"  (se ignora {os.path.basename(path)}: {e})")
    return mapping


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("excel")
    ap.add_argument("--appdata", default=os.path.join(os.environ.get("APPDATA", ""), "ModelKitLibrary"))
    ap.add_argument("--out")
    args = ap.parse_args()

    out = args.out or os.path.splitext(args.excel)[0] + "-imagenes.zip"
    covers_dir = os.path.join(args.appdata, "covers")
    if not os.path.isdir(covers_dir):
        sys.exit(f"No encuentro la carpeta de portadas: {covers_dir}")

    ws = load_workbook(args.excel, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [norm_header(str(h) if h is not None else "") for h in next(rows)]
    try:
        i_brand, i_ref, i_link = header.index("marca"), header.index("referencia"), header.index("ficha")
    except ValueError:
        sys.exit("El Excel necesita las columnas Marca, Referencia y Ficha.")

    mapping = covers_by_url(args.appdata)
    added, missing, used = 0, [], set()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as z:  # JPG ya va comprimido
        for n, r in enumerate(rows, start=2):
            brand, ref, link = r[i_brand], r[i_ref], r[i_link]
            if not brand or not ref:
                continue
            image = mapping.get(link)
            path = os.path.join(covers_dir, image) if image else None
            if not path or not os.path.isfile(path):
                missing.append(f"fila {n}: {brand} {ref}")
                continue
            name = f"{safe_name(str(brand))}-{safe_name(str(ref))}{os.path.splitext(image)[1].lower()}"
            if name in used:
                continue
            used.add(name)
            z.write(path, name)
            added += 1

    print(f"ZIP creado: {out}")
    print(f"Imágenes incluidas: {added}")
    if missing:
        print(f"Sin portada en ModelKitLibrary ({len(missing)}):")
        for m in missing:
            print(f"  - {m}")


if __name__ == "__main__":
    main()
