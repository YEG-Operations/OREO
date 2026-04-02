#!/usr/bin/env python3
"""
Importa i fornitori dai file AI_Parameters_Excels in Supabase.

Uso:
  python3 seed_fornitori.py                    # Genera fornitori.json (dry run)
  python3 seed_fornitori.py --upload           # Upload diretto a Supabase
  python3 seed_fornitori.py --upload --clean   # Pulisce tabella prima di caricare

Configurazione:
  export SUPABASE_URL=https://xxx.supabase.co
  export SUPABASE_SERVICE_KEY=xxx
"""

import os
import json
import sys
import re

try:
    import openpyxl
except ImportError:
    print("pip install openpyxl")
    sys.exit(1)

EXCEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'AI_Parameters_Excels')
OUTPUT = os.path.join(os.path.dirname(__file__), 'fornitori.json')

# Mapping file → categoria Supabase
FILE_CATEGORY = {
    'AI_Parameters_Catering_e_Ristorazione.xlsx': 'catering',
    'AI_Parameters_DMC_e_Incoming.xlsx': 'dmc',
    'AI_Parameters_Entertainment_e_Testimonial.xlsx': 'entertainment',
    'AI_Parameters_Hotel_e_Alloggi.xlsx': 'hotel',
    'AI_Parameters_Location_e_Venue.xlsx': 'location',
    'AI_Parameters_Ristoranti.xlsx': 'ristoranti',
    'AI_Parameters_Service_Allestimenti_e_Materiali.xlsx': 'allestimenti',
    'AI_Parameters_Team_Building_e_Esperienze.xlsx': 'teambuilding',
    'AI_Parameters_Trasporti_e_Bus.xlsx': 'trasporti',
}

# Colonne attese (identiche in tutti i file)
# 0: Nome Fornitore
# 1: Città / Area
# 2: Indirizzo
# 3: Capacità (Pax)
# 4: Range di Prezzo
# 5: Telefono
# 6: Email
# 7: Sito Web
# 8: Descrizione e Note
# 9: Tags & Keywords
# 10: Fonte File


def is_valid_name(name):
    """Filtra righe dove 'Nome Fornitore' non e' un vero nome."""
    if not name or not str(name).strip():
        return False
    s = str(name).strip()
    # Scarta se e' un orario (es. "08:30:00")
    if re.match(r'^\d{2}:\d{2}(:\d{2})?$', s):
        return False
    # Scarta se e' solo un numero
    if re.match(r'^[\d.,\s€$]+$', s):
        return False
    # Scarta se e' un'email pura
    if re.match(r'^[\w.+-]+@[\w.-]+\.\w+$', s):
        return False
    # Scarta se e' un numero di telefono puro
    if re.match(r'^[\+\d\s\.\-/()]{7,}$', s.replace('Tel.', '').replace('tel.', '').strip()):
        return False
    # Scarta stringhe troppo corte (< 3 caratteri)
    if len(s) < 3:
        return False
    return True


def parse_prezzo(raw):
    """Estrae prezzo_min e prezzo_max da stringhe come '6.000,00 - 7.000,00 €'."""
    if not raw:
        return None, None
    s = str(raw).strip()
    # Rimuovi simboli valuta
    s = s.replace('€', '').replace('$', '').replace('EUR', '').strip()
    # Trova numeri con formato italiano (1.000,00) o semplice
    numbers = re.findall(r'[\d.]+,\d{2}|[\d.]+', s)
    parsed = []
    for n in numbers:
        # Converti formato italiano: 6.000,00 → 6000.00
        if ',' in n:
            n = n.replace('.', '').replace(',', '.')
        else:
            # Potrebbe essere 6.000 (migliaia) o 6.5 (decimale)
            if n.count('.') == 1 and len(n.split('.')[-1]) == 3:
                n = n.replace('.', '')  # 6.000 → 6000
        try:
            parsed.append(float(n))
        except ValueError:
            pass
    if len(parsed) >= 2:
        return min(parsed), max(parsed)
    elif len(parsed) == 1:
        return parsed[0], parsed[0]
    return None, None


def parse_capacita(raw):
    """Estrae capacita numerica da stringhe varie."""
    if not raw:
        return None
    if isinstance(raw, (int, float)):
        return int(raw)
    s = str(raw).strip()
    # Cerca il primo numero
    m = re.search(r'(\d[\d.]*)', s.replace('.', ''))
    if m:
        try:
            return int(float(m.group(1)))
        except ValueError:
            pass
    return None


def clean_string(val):
    """Pulisce un valore stringa."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() == 'none' or s.lower() == 'n/a':
        return None
    # Rimuovi newline multipli
    s = re.sub(r'\n+', ' | ', s)
    return s


def parse_tags(raw):
    """Estrae tags come lista."""
    if not raw:
        return []
    s = str(raw).strip()
    # Split per virgola, punto e virgola, o pipe
    tags = re.split(r'[,;|]', s)
    return [t.strip() for t in tags if t.strip() and len(t.strip()) > 1]


def process_file(filepath, categoria):
    """Legge un file Excel e restituisce lista di fornitori."""
    fornitori = []
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
    except Exception as e:
        print(f"  [ERRORE] {filepath}: {e}")
        return []

    if len(rows) < 2:
        return []

    # Skip header row
    for row in rows[1:]:
        if len(row) < 11:
            continue

        nome = clean_string(row[0])
        if not is_valid_name(nome):
            continue

        citta = clean_string(row[1])
        indirizzo = clean_string(row[2])
        capacita = parse_capacita(row[3])
        prezzo_min, prezzo_max = parse_prezzo(row[4])
        telefono = clean_string(row[5])
        email = clean_string(row[6])
        sito_web = clean_string(row[7])
        descrizione = clean_string(row[8])
        tags = parse_tags(row[9])
        fonte_file = clean_string(row[10])

        # Costruisci contatti
        contatti = {}
        if telefono:
            contatti['telefono'] = telefono
        if email:
            contatti['email'] = email

        # Costruisci specifiche basate sulla categoria
        specifiche = {}
        if tags:
            specifiche['tags'] = tags

        # Determina adatto_per dai tags
        adatto_per = []
        tags_lower = ' '.join(tags).lower() + ' ' + (descrizione or '').lower()
        if any(k in tags_lower for k in ['convention', 'congresso', 'conferenz']):
            adatto_per.append('convention')
        if any(k in tags_lower for k in ['galadinner', 'gala', 'cena']):
            adatto_per.append('galadinner')
        if any(k in tags_lower for k in ['meeting', 'riunione', 'sala']):
            adatto_per.append('meeting')
        if any(k in tags_lower for k in ['party', 'festa', 'aperitivo']):
            adatto_per.append('party')
        if any(k in tags_lower for k in ['incentive', 'viaggio']):
            adatto_per.append('incentive')
        if any(k in tags_lower for k in ['teambuilding', 'team building', 'team']):
            adatto_per.append('teambuilding')

        # Prezzo unita in base alla categoria
        prezzo_unita = None
        if prezzo_min is not None:
            if categoria in ('catering', 'ristoranti'):
                prezzo_unita = 'a persona'
            elif categoria == 'hotel':
                prezzo_unita = 'a camera/notte'
            elif categoria == 'location':
                prezzo_unita = 'a giornata'
            elif categoria == 'trasporti':
                prezzo_unita = 'a servizio'
            else:
                prezzo_unita = 'forfait'

        fornitore = {
            'nome': nome,
            'categoria': categoria,
            'citta': citta,
            'regione': None,
            'capacita_min': None,
            'capacita_max': capacita,
            'prezzo_min': prezzo_min,
            'prezzo_max': prezzo_max,
            'prezzo_unita': prezzo_unita,
            'specifiche': specifiche,
            'contatti': contatti,
            'servizi_inclusi': [],
            'adatto_per': adatto_per,
            'note': descrizione,
            'file_sorgente': fonte_file,
            'sito_web': sito_web,
            'immagine_url': None,
            'is_yeg_supplier': True,
            'attivo': True,
        }
        fornitori.append(fornitore)

    return fornitori


def deduplicate(items):
    """Rimuove duplicati per nome+categoria+citta."""
    seen = set()
    unique = []
    for item in items:
        key = (
            item['nome'].lower().strip(),
            item['categoria'],
            (item.get('citta') or '').lower().strip()
        )
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def upload_to_supabase(fornitori, clean=False):
    """Upload a Supabase via REST API."""
    import urllib.request
    import urllib.error

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        print("ERRORE: SUPABASE_URL e SUPABASE_SERVICE_KEY richiesti")
        sys.exit(1)

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }

    # Pulisci tabella se richiesto
    if clean:
        print("  Pulizia tabella fornitori...")
        req = urllib.request.Request(
            f"{url}/rest/v1/fornitori?id=gt.0",
            headers={**headers, 'Prefer': 'return=minimal'},
            method='DELETE'
        )
        try:
            urllib.request.urlopen(req)
            print("  Tabella pulita.")
        except urllib.error.HTTPError as e:
            print(f"  Errore pulizia: {e.code} {e.read().decode()}")

    # Upload in batch
    batch_size = 50
    success = 0
    for i in range(0, len(fornitori), batch_size):
        batch = fornitori[i:i + batch_size]
        data = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(
            f"{url}/rest/v1/fornitori",
            data=data,
            headers=headers,
            method='POST'
        )
        try:
            urllib.request.urlopen(req)
            success += len(batch)
            print(f"  Batch {i // batch_size + 1}: {len(batch)} fornitori caricati ({success}/{len(fornitori)})")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            print(f"  ERRORE batch {i // batch_size + 1}: {e.code} - {err_body[:200]}")

    print(f"\nUpload completato: {success}/{len(fornitori)} fornitori caricati")


if __name__ == '__main__':
    print(f"\nLettura file AI_Parameters da: {EXCEL_DIR}\n")

    all_fornitori = []

    for filename, categoria in sorted(FILE_CATEGORY.items()):
        filepath = os.path.join(EXCEL_DIR, filename)
        if not os.path.isfile(filepath):
            print(f"  [SKIP] {filename} non trovato")
            continue

        result = process_file(filepath, categoria)
        print(f"  {categoria:20s} → {len(result):4d} fornitori  ({filename})")
        all_fornitori.extend(result)

    # Deduplicazione
    before = len(all_fornitori)
    all_fornitori = deduplicate(all_fornitori)
    after = len(all_fornitori)
    dupes = before - after

    print(f"\n{'='*50}")
    print(f"Totale fornitori validi: {after}")
    if dupes > 0:
        print(f"Duplicati rimossi: {dupes}")

    # Riepilogo per categoria
    per_cat = {}
    for f in all_fornitori:
        per_cat[f['categoria']] = per_cat.get(f['categoria'], 0) + 1
    for cat, count in sorted(per_cat.items()):
        print(f"  {cat:20s}: {count}")

    # Stats dati compilati
    with_price = sum(1 for f in all_fornitori if f['prezzo_min'] is not None)
    with_cap = sum(1 for f in all_fornitori if f['capacita_max'] is not None)
    with_city = sum(1 for f in all_fornitori if f['citta'] is not None)
    with_web = sum(1 for f in all_fornitori if f['sito_web'] is not None)
    with_contact = sum(1 for f in all_fornitori if f['contatti'])
    print(f"\n  Con prezzo:    {with_price:4d} ({with_price*100//after}%)")
    print(f"  Con capacita:  {with_cap:4d} ({with_cap*100//after}%)")
    print(f"  Con citta:     {with_city:4d} ({with_city*100//after}%)")
    print(f"  Con sito web:  {with_web:4d} ({with_web*100//after}%)")
    print(f"  Con contatti:  {with_contact:4d} ({with_contact*100//after}%)")

    # Salva JSON
    with open(OUTPUT, 'w', encoding='utf-8') as fout:
        json.dump(all_fornitori, fout, ensure_ascii=False, indent=2)
    print(f"\nSalvato: {OUTPUT}")

    # Upload a Supabase
    if '--upload' in sys.argv:
        clean = '--clean' in sys.argv
        upload_to_supabase(all_fornitori, clean=clean)
