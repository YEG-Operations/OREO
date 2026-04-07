"""
Import fornitori nelle tabelle categoria-specifiche.
Omologa i due file hotel + i due file location.
Esegui DOPO aver applicato migrate_category_tables.sql su Supabase.
"""

import re
import openpyxl
from supabase import create_client

SUPABASE_URL = "https://qrlyowsrtqwsvolaitsn.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybHlvd3NydHF3c3ZvbGFpdHNuIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1NjY4OSwiZXhwIjoyMDkwNjMyNjg5fQ."
    "Y6r6yuhIGyj9qRFp5PntCaR_Ls0ExszsI6AUB4kv1M0"
)
BASE = "/Users/emanuele.campanini/Desktop/n8n loreal/File fornitori"

# ── helpers ──────────────────────────────────────────────────────────────────

def cv(v):
    """None / blank / dash → None."""
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s not in ('-', '—', 'None', 'N/A', 'n.d.', 'nd', 'DA VERIFICARE') else None


def parse_price(v):
    if v is None:
        return None
    s = str(v).replace('€', '').replace('\xa0', '').replace(' ', '')
    s = re.sub(r'\.(?=\d{3})', '', s)
    s = s.replace(',', '.')
    m = re.search(r'\d+(\.\d+)?', s)
    return float(m.group()) if m else None


def parse_int(v):
    if v is None:
        return None
    m = re.search(r'\d+', str(v))
    return int(m.group()) if m else None


def extract_email(s):
    if not s:
        return None
    m = re.search(r'[\w.+\-]+@[\w.\-]+\.\w+', str(s))
    return m.group() if m else None


def extract_tel(s):
    if not s:
        return None
    m = re.search(r'(?:\+\d[\d\s\-./]{6,}|\b\d[\d\s\-./]{8,})', str(s))
    return m.group().strip().rstrip('.') if m else None


def normalize_url(v):
    if not v:
        return None
    s = str(v).strip()
    if '.' not in s or s in ('-', 'None'):
        return None
    parts = re.split(r'[\s,;]', s)
    for p in parts:
        if '.' in p and len(p) > 4:
            s = p.strip()
            break
    if not s.startswith('http'):
        s = 'https://' + s
    return s


def split_list(v):
    """Stringa separata da ; o , → list[str]."""
    if not v:
        return []
    parts = re.split(r'[;,]', str(v))
    return [p.strip() for p in parts if p.strip() and p.strip() not in ('-',)]


def load_sheet(path, sheet):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    wb.close()
    return [r for r in rows
            if any(v is not None and str(v).strip() not in ('', '-') for v in r)]


def to_dict(headers, row):
    return {headers[i]: (row[i] if i < len(row) else None) for i in range(len(headers))}


def upload(sb, table, records):
    """Carica in batch da 200, fallback riga per riga sugli errori."""
    ok = err = 0
    BATCH = 200
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        try:
            sb.table(table).insert(batch).execute()
            ok += len(batch)
        except Exception as e:
            print(f'  batch error ({table}): {e}')
            for rec in batch:
                try:
                    sb.table(table).insert(rec).execute()
                    ok += 1
                except Exception as e2:
                    err += 1
                    print(f'  SKIP {rec.get("nome") or rec.get("fornitore")}: {e2}')
    return ok, err


# ── HOTEL ─────────────────────────────────────────────────────────────────────

def load_hotel():
    records = []
    seen = set()

    # Hotel 2 (dati più ricchi, ha priorità)
    rows = load_sheet(f'{BASE}/Hotel 2.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome Location'))
        if not nome:
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        citta_raw = cv(d.get('Città / Zona')) or ''
        citta = citta_raw.split('/')[0].split(',')[0].strip() or None

        records.append({
            'nome': nome,
            'citta': citta,
            'tipologia': cv(d.get('Tipologia')),
            'capienza_max': parse_int(cv(d.get('Capienza Max'))),
            'spazi_disponibili': cv(d.get('Spazi Disponibili')),
            'servizi_offerti': cv(d.get('Servizi Offerti')),
            'prezzo_indicativo': cv(d.get('Prezzo Indicativo')),
            'allestimento_base': cv(d.get('Allestimento Base')),
            'catering_esterno': cv(d.get('Catering')),
            'punti_di_forza': cv(d.get('Punti di Forza')),
            'criticita': cv(d.get('Criticità')),
            'note_tecniche': cv(d.get('Note Tecniche')),
            'email': extract_email(cv(d.get('Contatti'))),
            'sito_web': normalize_url(cv(d.get('Sito Web'))),
            'fonte': 'Hotel 2.xlsx',
        })

    # Hotel Unificato (integra i mancanti)
    rows = load_sheet(f'{BASE}/HOTEL_FORNITORI_UNIFICATO.xlsx', 'TUTTI I FORNITORI HOTEL')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('FORNITORE'))
        if not nome:
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        records.append({
            'nome': nome,
            'citta': cv(d.get('CITTÀ')),
            'provincia': cv(d.get('PROVINCIA')),
            'stelle': cv(d.get('STELLE')),
            'tipologia': cv(d.get('TIPOLOGIA')),
            'num_camere': parse_int(cv(d.get('NUM CAMERE'))),
            'capienza_max': parse_int(cv(d.get('CAPIENZA MAX PAX'))),
            'sale_meeting': cv(d.get('SALE MEETING')),
            'telefono': cv(d.get('TELEFONO')),
            'email': cv(d.get('MAIL')),
            'sito_web': normalize_url(cv(d.get('SITO WEB'))),
            'parcheggio': cv(d.get('PARCHEGGIO')),
            'ristorante': cv(d.get('RISTORANTE')),
            'wellness_spa': cv(d.get('WELLNESS/SPA')),
            'voto': cv(d.get('VOTO')),
            'note': cv(d.get('NOTE')),
            'fonte': cv(d.get('FONTE')) or 'HOTEL_FORNITORI_UNIFICATO.xlsx',
        })

    print(f'  Hotel: {len(records)}')
    return records


# ── LOCATION ──────────────────────────────────────────────────────────────────

def load_location():
    records = []
    seen = set()

    # Scouting Location Varie (ha priorità, stessa struttura)
    rows = load_sheet(f'{BASE}/SCOUTING LOCATION VARIE.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome Location'))
        if not nome:
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        citta_raw = cv(d.get('Città / Zona')) or ''
        citta = citta_raw.split('/')[0].split(',')[0].strip() or None
        contatti_raw = cv(d.get('Contatti'))

        records.append({
            'nome': nome,
            'citta': citta,
            'tipologia': cv(d.get('Tipologia')),
            'capienza_max': parse_int(cv(d.get('Capienza Max'))),
            'spazi_disponibili': cv(d.get('Spazi Disponibili')),
            'servizi_offerti': cv(d.get('Servizi Offerti')),
            'prezzo_indicativo': cv(d.get('Prezzo Indicativo')),
            'allestimento_base': cv(d.get('Allestimento Base')),
            'catering_esterno': cv(d.get('Catering')),
            'punti_di_forza': cv(d.get('Punti di Forza')),
            'criticita': cv(d.get('Criticità')),
            'note_tecniche': cv(d.get('Note Tecniche')),
            'contatto_email': extract_email(contatti_raw),
            'contatto_tel': extract_tel(contatti_raw),
            'sito_web': normalize_url(cv(d.get('Sito Web'))),
            'fonte': 'SCOUTING LOCATION VARIE.xlsx',
        })

    # LOCATION.xlsx (integra i mancanti)
    rows = load_sheet(f'{BASE}/LOCATION.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome Venue')) or cv(d.get('Fornitore'))
        if not nome:
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        citta = cv(d.get('Città'))
        if citta:
            citta = citta.title() if not citta.istitle() else citta
        contatti_raw = cv(d.get('Contatti'))

        records.append({
            'nome': nome,
            'citta': citta,
            'tipologia': cv(d.get('Tipo')),
            'capienza_max': parse_int(cv(d.get('Capienza Max'))),
            'prezzo': parse_price(cv(d.get('Prezzo (€)'))),
            'unita_prezzo': cv(d.get('Unità Prezzo')),
            'contatto_nome': contatti_raw[:80] if contatti_raw else None,
            'contatto_email': extract_email(contatti_raw),
            'note': cv(d.get('Note')),
            'completezza_dati': cv(d.get('Completezza dati')),
            'fonte': 'LOCATION.xlsx',
        })

    print(f'  Location: {len(records)}')
    return records


# ── CATERING ──────────────────────────────────────────────────────────────────

def load_catering():
    records = []
    seen = set()

    # CATEGORIZZATO (dati strutturati, priorità)
    rows = load_sheet(f'{BASE}/CATERING.xlsx', 'CATEGORIZZATO')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome Fornitore'))
        if not nome or nome.upper() == 'YEG':
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        contatti_raw = cv(d.get('Contatti')) or ''
        note_raw = cv(d.get('Note / Punti di forza'))
        is_yeg = bool(note_raw and 'YEG' in note_raw)

        citta_raw = cv(d.get('Città / Zona')) or ''
        citta = citta_raw.split('/')[0].strip() or None

        records.append({
            'nome': nome,
            'citta': citta,
            'telefono': extract_tel(contatti_raw),
            'email': extract_email(contatti_raw),
            'adatto_a': split_list(cv(d.get('Adatto a (tipo evento)'))),
            'servizi': split_list(cv(d.get('Cosa include (aperitivo + cena)'))),
            'extra_disponibili': split_list(cv(d.get('Extra disponibili'))),
            'allestimento_incluso': cv(d.get('Allestimento incluso')),
            'prezzo_persona': parse_price(cv(d.get('Prezzo/persona €/p (IVA escl.)'))),
            'condizioni_pagamento': cv(d.get('Condizioni pagamento')),
            'note': note_raw,
            'is_yeg_supplier': is_yeg,
            'fonte': 'CATERING_CATEGORIZZATO',
        })

    # GENERICO (integra i mancanti)
    rows = load_sheet(f'{BASE}/CATERING.xlsx', 'GENERICO')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome'))
        if not nome:
            continue
        key = nome.lower()
        if key in seen:
            continue
        seen.add(key)

        indirizzo = cv(d.get('Indirizzo')) or ''
        email_raw = cv(d.get('Email')) or ''

        records.append({
            'nome': nome,
            'indirizzo': indirizzo,
            'telefono': cv(d.get('Telefono')),
            'email': email_raw.split(';')[0].strip() if email_raw else None,
            'sito_web': normalize_url(cv(d.get('Sito web'))),
            'referente': cv(d.get('Referente')),
            'fonte': 'CATERING_GENERICO',
        })

    print(f'  Catering: {len(records)}')
    return records


# ── DMC ────────────────────────────────────────────────────────────────────────

def load_dmc():
    records = []
    rows = load_sheet(f'{BASE}/DMC.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]
    seen = set()

    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome DMC'))
        if not nome:
            continue
        if nome.lower() in seen:
            continue
        seen.add(nome.lower())

        paese = cv(d.get('Paese/Regione'))
        citta_raw = cv(d.get('Città Principali'))
        citta = citta_raw.split(',')[0].strip() if citta_raw else paese
        contatti_raw = cv(d.get('Contatti')) or ''

        records.append({
            'nome': nome,
            'paese_regione': paese,
            'citta': citta,
            'tipologia_servizi': cv(d.get('Tipologia Servizi')),
            'specializzazioni': cv(d.get('Specializzazioni')),
            'contatto_email': extract_email(contatti_raw),
            'contatto_tel': extract_tel(contatti_raw),
            'sito_web': normalize_url(cv(d.get('Sito Web'))),
            'network': cv(d.get('Network/Appartenenza')),
            'lingue': cv(d.get('Lingue Supportate')),
            'note': cv(d.get('Note / Punti di Forza')),
        })

    print(f'  DMC: {len(records)}')
    return records


# ── TEAMBUILDING / EXPERIENCE ──────────────────────────────────────────────────

def load_teambuilding():
    records = []
    rows = load_sheet(f'{BASE}/EXPERIENCE.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]

    # raggruppa per fornitore
    grouped = {}
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        fornitore = cv(d.get('Fornitore'))
        if not fornitore:
            continue
        if fornitore not in grouped:
            grouped[fornitore] = {
                'citta': cv(d.get('Città')),
                'contatti': cv(d.get('Contatti')),
                'attivita': [],
                'categorie': set(),
                'pax_min': [],
                'pax_max': [],
                'durata': [],
                'prezzi': [],
                'note': [],
            }
        g = grouped[fornitore]
        attivita = cv(d.get('Attività'))
        if attivita:
            g['attivita'].append(attivita)
        cat = cv(d.get('Categoria'))
        if cat:
            g['categorie'].add(cat)
        pmin = parse_int(cv(d.get('Pax Min')))
        pmax = parse_int(cv(d.get('Pax Max')))
        if pmin:
            g['pax_min'].append(pmin)
        if pmax:
            g['pax_max'].append(pmax)
        dur = cv(d.get('Durata'))
        if dur:
            g['durata'].append(dur)
        prezzo = parse_price(cv(d.get('Prezzo (€)')))
        if prezzo:
            g['prezzi'].append(prezzo)
        nota = cv(d.get('Note'))
        if nota:
            g['note'].append(nota)

    for fornitore, g in grouped.items():
        citta = g['citta']
        if citta:
            citta = citta.title() if citta.isupper() else citta
        contatti_raw = g['contatti'] or ''
        prezzi = g['prezzi']

        records.append({
            'fornitore': fornitore,
            'citta': citta,
            'attivita': g['attivita'],
            'categoria_attivita': ', '.join(sorted(g['categorie'])) if g['categorie'] else None,
            'pax_min': min(g['pax_min']) if g['pax_min'] else None,
            'pax_max': max(g['pax_max']) if g['pax_max'] else None,
            'durata': ' / '.join(dict.fromkeys(g['durata'])) if g['durata'] else None,
            'prezzo_min': min(prezzi) if prezzi else None,
            'prezzo_max': max(prezzi) if prezzi else None,
            'contatto_email': extract_email(contatti_raw),
            'contatto_tel': extract_tel(contatti_raw),
            'note': ' | '.join(g['note']) if g['note'] else None,
        })

    print(f'  TeamBuilding: {len(records)}')
    return records


# ── RISTORANTI ─────────────────────────────────────────────────────────────────

def load_ristoranti():
    records = []
    seen = set()

    # FOOD.xlsx (dati più ricchi, priorità)
    rows = load_sheet(f'{BASE}/FOOD.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Nome Ristorante/Venue')) or cv(d.get('Fornitore'))
        if not nome:
            continue
        # pulisci suffissi " - Menu YEG 1"
        nome_clean = re.sub(r'\s*-\s*Menu.*$', '', nome).strip()
        key = nome_clean.lower()
        if key in seen:
            continue
        seen.add(key)

        citta = cv(d.get('Città'))
        if citta:
            citta = citta.title()
        contatti_raw = cv(d.get('Contatti')) or ''

        records.append({
            'nome': nome_clean,
            'citta': citta,
            'tipo': cv(d.get('Tipo')),
            'capienza_max': parse_int(cv(d.get('Pax Max'))),
            'prezzo_pax': parse_price(cv(d.get('Prezzo/Pax (€)'))),
            'portate': cv(d.get('Portate')),
            'bevande_incluse': cv(d.get('Bevande incluse')),
            'email': extract_email(contatti_raw),
            'contatti': contatti_raw[:200] if contatti_raw else None,
            'note': cv(d.get('Note')),
            'fonte': 'FOOD.xlsx',
        })

    # RISTORANTI_ITALIA_UNIFICATO (integra i mancanti)
    rows = load_sheet(f'{BASE}/RISTORANTI_ITALIA_UNIFICATO.xlsx', 'TUTTI I RISTORANTI')
    hdrs = [cv(h) for h in rows[0]]
    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('RISTORANTE'))
        if not nome:
            continue
        if nome.lower() in seen:
            continue
        seen.add(nome.lower())

        records.append({
            'nome': nome,
            'citta': cv(d.get('CITTÀ')),
            'capienza_max': parse_int(cv(d.get('SET'))),
            'email': cv(d.get('MAIL')),
            'telefono': cv(d.get('TEL')),
            'fonte': 'RISTORANTI_ITALIA_UNIFICATO.xlsx',
        })

    print(f'  Ristoranti: {len(records)}')
    return records


# ── ALLESTIMENTI ───────────────────────────────────────────────────────────────

def load_allestimenti():
    records = []
    rows = load_sheet(
        f'{BASE}/SERVICE_ALLESTIMENTI_MATERIALI_FORNITORI_UNIFICATO.xlsx',
        'TUTTI I FORNITORI SERVICE'
    )
    hdrs = [cv(h) for h in rows[0]]

    for row in rows[1:]:
        d = to_dict(hdrs, row)
        fornitore = cv(d.get('FORNITORE'))
        if not fornitore:
            continue

        mail_sito = cv(d.get('MAIL / SITO WEB')) or ''
        prezzo_raw = cv(d.get('PREZZO (€)'))
        iva_raw = cv(d.get('IVA %'))
        iva = parse_price(iva_raw) if iva_raw else None

        records.append({
            'fornitore': fornitore,
            'categoria_servizio': cv(d.get('CATEGORIA')),
            'prodotto_servizio': cv(d.get('PRODOTTO / SERVIZIO')),
            'descrizione': cv(d.get('DESCRIZIONE / DIMENSIONI')),
            'unita': cv(d.get('UNITÀ')),
            'prezzo': parse_price(prezzo_raw),
            'iva_percentuale': iva,
            'citta': cv(d.get('CITTÀ / SEDE')),
            'telefono': cv(d.get('TELEFONO')),
            'email': extract_email(mail_sito),
            'sito_web': normalize_url(mail_sito),
            'note': cv(d.get('NOTE')),
            'fonte': cv(d.get('FONTE')),
        })

    print(f'  Allestimenti: {len(records)} voci ({len({r["fornitore"] for r in records})} fornitori)')
    return records


# ── ENTERTAINMENT ──────────────────────────────────────────────────────────────

def load_entertainment():
    records = []
    rows = load_sheet(f'{BASE}/Speaker & Guest.xlsx', 'Foglio1')
    hdrs = [cv(h) for h in rows[0]]

    for row in rows[1:]:
        d = to_dict(hdrs, row)
        nome = cv(d.get('Servizio/Artista'))
        if not nome:
            continue

        iva = parse_price(cv(d.get('IVA %')))
        incluso = cv(d.get('Cosa è Incluso'))
        contatti_raw = cv(d.get('Contatti')) or ''
        sito = normalize_url(cv(d.get('Link Video/Sito')))

        records.append({
            'nome': nome,
            'categoria_artista': cv(d.get('Categoria')),
            'agenzia': cv(d.get('Agenzia/Fornitore')),
            'citta': cv(d.get('Sede Base')),
            'prezzo_netto_min': parse_price(cv(d.get('Prezzo Netto Min (€)'))),
            'prezzo_netto_max': parse_price(cv(d.get('Prezzo Netto Max (€)'))),
            'iva_percentuale': iva,
            'prezzo_totale_min': parse_price(cv(d.get('Prezzo Totale Min (€)'))),
            'prezzo_totale_max': parse_price(cv(d.get('Prezzo Totale Max (€)'))),
            'servizi_inclusi': split_list(incluso) if incluso else [],
            'costi_extra': cv(d.get('Costi Extra a Carico Cliente')),
            'durata_formato': cv(d.get('Durata/Formato')),
            'vantaggi_usp': cv(d.get('Vantaggi/USP')),
            'personalizzabile': cv(d.get('Personalizzabile')),
            'contatto_email': extract_email(contatti_raw),
            'contatto_tel': extract_tel(contatti_raw),
            'sito_web': sito,
            'validita': cv(d.get('Validità/Condizioni')),
            'condizioni_pagamento': cv(d.get('Pagamento')),
            'fonte': 'Speaker & Guest.xlsx',
        })

    print(f'  Entertainment: {len(records)}')
    return records


# ── TRASPORTI ──────────────────────────────────────────────────────────────────

def load_trasporti():
    records = []
    rows = load_sheet(
        f'{BASE}/ASSISTENZE_AEROPORTUALI_FORNITORI_UNIFICATO.xlsx',
        'TUTTI I FORNITORI ASSISTENZE'
    )
    hdrs = [cv(h) for h in rows[0]]

    for row in rows[1:]:
        d = to_dict(hdrs, row)
        fornitore = cv(d.get('FORNITORE'))
        if not fornitore:
            continue

        records.append({
            'fornitore': fornitore,
            'tipo_servizio': cv(d.get('TIPO SERVIZIO')),
            'aeroporto': cv(d.get('AEROPORTO')),
            'codice_iata': cv(d.get('CODICE IATA')),
            'banchi_gruppi': cv(d.get('BANCHI GRUPPI')),
            'durata_base': cv(d.get('DURATA BASE')),
            'prezzo_base': parse_price(cv(d.get('PREZZO BASE (€ + IVA 22%)'))),
            'extra_ora': parse_price(cv(d.get('EXTRA / ORA (€ + IVA 22%)'))),
            'sala_vip_pax': cv(d.get('SALA VIP (€/pax)')),
            'fast_track_pax': cv(d.get('FAST TRACK (€/pax)')),
            'porter': cv(d.get('PORTER')),
            'telefono': cv(d.get('TELEFONO')),
            'email': cv(d.get('MAIL')),
            'supplementi': cv(d.get('SUPPLEMENTI')),
            'note': cv(d.get('NOTE')),
            'anno': cv(d.get('ANNO')),
            'fonte': cv(d.get('FONTE')),
        })

    print(f'  Trasporti: {len(records)}')
    return records


# ── MAIN ────────────────────────────────────────────────────────────────────────

TABLES = {
    'fornitori_hotel': load_hotel,
    'fornitori_location': load_location,
    'fornitori_catering': load_catering,
    'fornitori_dmc': load_dmc,
    'fornitori_teambuilding': load_teambuilding,
    'fornitori_ristoranti': load_ristoranti,
    'fornitori_allestimenti': load_allestimenti,
    'fornitori_entertainment': load_entertainment,
    'fornitori_trasporti': load_trasporti,
}


def main():
    print('\n📂 Lettura file Excel...')
    data = {}
    for table, loader in TABLES.items():
        data[table] = loader()

    total = sum(len(v) for v in data.values())
    print(f'\n✅ Totale record elaborati: {total}')

    print('\n🔌 Connessione a Supabase...')
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print('🗑️  Svuotamento tabelle...')
    for table in TABLES:
        try:
            sb.table(table).delete().neq('id', 0).execute()
            print(f'   {table} svuotata')
        except Exception as e:
            print(f'   WARN {table}: {e} (potrebbe non esistere ancora)')

    print('\n⬆️  Caricamento...')
    total_ok = total_err = 0
    for table, records in data.items():
        if not records:
            continue
        ok, err = upload(sb, table, records)
        total_ok += ok
        total_err += err
        print(f'   {table}: {ok} inseriti, {err} errori')

    print(f'\n🎉 Completato: {total_ok} inseriti, {total_err} errori.')


if __name__ == '__main__':
    main()
