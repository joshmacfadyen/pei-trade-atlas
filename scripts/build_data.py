"""
Step 2 of the build: turn the cleaned entries from prep.py into docs/data.json for the page.

    python build_data.py WORKBOOK.xlsx                      build data.json
    python build_data.py WORKBOOK.xlsx --explain "Sugar"    show how matching articles got their category

Inputs (in the working directory): rows.pkl (from prep.py) and routes.json (sea routes, static).
Output: data.json.

How an entry's category is decided
----------------------------------
1. prep.py gives each entry a SITC code (column `code`) from its own Commodity_Category cell on the
   Imports or Exports sheet, checked against the SITC 4 sheet, and records why in column `how`.
2. This script takes the code's first digit as its SITC section.
3. Sections listed in OWN_SECTIONS get their own colour; every other section is "Other".
So a wrong category is almost always a wrong Commodity_Category in the workbook for that entry. Use --explain to see each step for an article.
"""
import json
import os
import re
import sys

import openpyxl
import pandas as pd


# ----------------------------------------------------------------------------------------------
# Settings
# ----------------------------------------------------------------------------------------------

# SITC sections that get their own colour on the page, in key order. All others become "Other".
OWN_SECTIONS = ['0', '1', '2', '3', '6', '8']
OTHER_KEY = 'X'

# Where each recorded country or colony is drawn: (longitude, latitude, representative port).
PLACES = {
    'Nova Scotia':             (-63.57, 44.65, 'Halifax'),
    'New Brunswick':           (-66.06, 45.27, 'Saint John'),
    'United States':           (-71.06, 42.36, 'Boston'),
    'United Kingdom':          (-2.99, 53.41, 'Liverpool'),
    'Canada':                  (-71.21, 46.81, 'Quebec'),
    'Newfoundland':            (-52.71, 47.56, "St. John's"),
    'Saint-Pierre & Miquelon': (-56.18, 46.78, 'Saint-Pierre'),
    'Magdalen Islands':        (-61.85, 47.38, 'Havre Aubert'),
    'Bermuda':                 (-64.78, 32.29, 'Hamilton'),
    'West Indies':             (-66.0, 18.0, 'Caribbean'),
    'France':                  (-2.0, 48.65, 'Saint-Malo'),
}
NO_POSITION = (None, None, None)

# PEI harbours: (longitude, latitude). routes.json can move a dot to the water's edge.
PORTS = {
    'Charlottetown': (-63.126, 46.235),  'Georgetown':   (-62.533, 46.183),
    'Bedeque':       (-63.785, 46.385),  'Colville Bay': (-62.25, 46.36),
    'Murray Harbour': (-62.52, 46.0),    'Malpeque':     (-63.68, 46.54),
    'Cascumpec':     (-64.05, 46.77),    'New London':   (-63.5, 46.49),
    'Crapaud':       (-63.49, 46.24),    'Grand River':  (-63.87, 46.5),
    'Orwell Bay':    (-62.86, 46.13),    'Rustico':      (-63.27, 46.46),
    'Pinette':       (-62.89, 46.03),    "St. Peter's":  (-62.58, 46.43),
    'Tignish':       (-64.03, 46.95),
}

# Names prep.py gives entries whose country column could not be used.
PLACE_RENAMES = {
    'Country raw: British North American Colonies.': 'British N. American colonies (unspecified)',
    'Country raw: nan': 'Origin not recorded',
}

# Harbour spellings in the printed-total lines, for the reconciliation table.
HARBOUR_SPELLINGS = {'Murray Harbor': 'Murray Harbour', 'Cascumpeque': 'Cascumpec',
                     'St. Peters': "St. Peter's", 'Pinnette': 'Pinette'}

DIRECTIONS = {'Imports': 0, 'Exports': 1}


# ----------------------------------------------------------------------------------------------
# SITC names (all from the workbook's "SITC 4" sheet)
# ----------------------------------------------------------------------------------------------

def read_sitc_names(workbook):
    """Map SITC code -> description, e.g. '0741' -> 'Tea, whether or not flavoured'."""
    sheet = pd.read_excel(workbook, 'SITC 4', header=1, dtype=str)
    names = dict(zip(sheet.ProductCode.str.strip(), sheet.ProductDescription.str.strip()))
    return {code: fix_encoding(name) for code, name in names.items()}


def fix_encoding(text):
    """Repair encoding slips in the SITC 4 sheet ("birdsÆ eggs", "Tea and matT")."""
    return str(text).replace('Æ', '’').replace('matT', 'maté').strip()


def short_label(name):
    """Short form of a section name for keys: 'Crude materials, inedible, except fuels' -> 'Crude materials'."""
    return re.split(r',| classified chiefly| \(', name)[0].strip()


def division_label(name):
    """Division names stay whole, minus 'n.e.s.' and bracketed notes."""
    return re.sub(r'\s*\(.*?\)|,?\s*n\.e\.s\.?', '', name).strip(' ,')


def build_categories(sitc):
    """The page's colour categories: one per OWN_SECTIONS entry, then "Other"."""
    categories = [dict(key=s, name=sitc[s], label=short_label(sitc[s]), desc=f'SITC section {s}')
                  for s in OWN_SECTIONS]
    other_sections = [s for s in '0123456789' if s not in OWN_SECTIONS]
    other_list = ', '.join(f'{s} ({short_label(sitc[s]).lower()})' for s in other_sections)
    categories.append(dict(key=OTHER_KEY, name='Other', label='Other', desc=f'SITC sections {other_list}'))
    return categories


def category_index(section):
    """Position of a SITC section in the category list (unknown or missing sections are "Other")."""
    if isinstance(section, str) and section in OWN_SECTIONS:
        return OWN_SECTIONS.index(section)
    return len(OWN_SECTIONS)


def division_key(code):
    """Two-digit SITC division for a code. 'u' = no code; '4*' = code gives only the section."""
    if not isinstance(code, str):
        return 'u'
    return code[:2] if len(code) >= 2 else code + '*'


def division_name(key, sitc):
    if key == 'u':
        return 'Not classified'
    if key.endswith('*'):
        return sitc[key[0]] + ' (unspecified)'
    return sitc[key]


def clean_article(article):
    """Tidy an article name for grouping and search: 'Sugar, refined. ' -> 'Sugar, refined'."""
    article = re.sub(r'\s+', ' ', article).strip().rstrip(',.;: ').strip()
    return article[:1].upper() + article[1:]


# ----------------------------------------------------------------------------------------------
# Printed totals (Appendix C)
# ----------------------------------------------------------------------------------------------

def pounds_from_lsd(text):
    """'1768 6 7 1/2' (pounds, shillings, pence) -> 1768.3302 pounds."""
    text = str(text).replace('£', '').replace(',', '').strip()
    half_penny = 0
    for fraction, value in (('1/2', .5), ('1/4', .25), ('3/4', .75)):
        if fraction in text:
            half_penny = value
            text = text.replace(fraction, '')
    numbers = [int(n) for n in re.findall(r'\d+', text)]
    if not numbers:
        return None
    pounds, shillings, pence = (numbers + [0, 0])[:3]
    return pounds + shillings / 20 + (pence + half_penny) / 240


def read_printed_totals(workbook):
    """The import returns' own "Total imports from all countries" lines: {(year, harbour): (pounds, text, row)}."""
    sheet = openpyxl.load_workbook(workbook, read_only=True, data_only=True)['Imports']
    rows = sheet.iter_rows(values_only=True)
    header = [str(h).strip() if h else h for h in next(rows)]
    totals = {}
    for row_index, values in enumerate(rows):
        row = dict(zip(header, values))
        article = str(row['Article'] or '')
        is_total = re.search(r'total.*all countries|total value of imports', article, re.I)
        is_carry = re.search(r'carried|brought', article, re.I)
        if not is_total or is_carry:
            continue
        harbour = HARBOUR_SPELLINGS.get(row['harbour_name'], row['harbour_name'])
        key = (int(row['Year']), harbour)
        printed = row['Value_Of_Total_Imports']
        if key in totals or printed in (None, ''):
            continue
        pounds = pounds_from_lsd(printed)
        if pounds:
            totals[key] = (pounds, str(printed).strip(), row_index + 2)   # +2: header row, 1-based rows
    return totals


# ----------------------------------------------------------------------------------------------
# Debugging: --explain
# ----------------------------------------------------------------------------------------------

def explain(entries, query, categories):
    """Print, for every entry whose article contains `query`, how its category was reached."""
    matches = entries[entries.a.str.contains(query, case=False, regex=False, na=False)]
    if matches.empty:
        print(f'No entries with an article containing "{query}".')
        return
    print(f'{len(matches)} entries with an article containing "{query}":\n')
    columns = ['d', 'y', 'p', 'a', 'code', 'sec', 'cat', 'how']
    grouped = matches.groupby(['d', 'a', 'code', 'how'], dropna=False)
    for (direction, article, code, how), group in grouped:
        section = code[0] if isinstance(code, str) else None
        category = categories[category_index(section)]['label']
        print(f'{direction}: "{article}"  ({len(group)} entries, £{group.v.sum():,.2f})')
        print(f'  1. SITC code {code}   <- {how}')
        print(f'  2. section {section}')
        print(f'  3. category: {category}')
        print(f'  workbook rows: {", ".join(str(r) for r in sorted(group.xr)[:12])}'
              + (' …' if len(group) > 12 else '') + '\n')


# ----------------------------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------------------------

def main():
    workbook = sys.argv[1]
    entries = pd.read_pickle('rows.pkl')
    sitc = read_sitc_names(workbook)
    categories = build_categories(sitc)

    if '--explain' in sys.argv:
        explain(entries, sys.argv[sys.argv.index('--explain') + 1], categories)
        return

    # Derived columns
    entries['c'] = entries.c.replace(PLACE_RENAMES)
    entries['cat'] = entries.sec.map(category_index)
    entries['dk'] = entries.code.map(division_key)
    entries['art'] = entries.a.map(clean_article)
    years = sorted(entries.y.unique())
    entries['yi'] = entries.y.map({year: i for i, year in enumerate(years)})

    # Lookup lists; the page refers to places, harbours and articles by their index in these
    places = sorted(entries.c.unique(), key=lambda name: -entries[entries.c == name].v.sum())
    ports = sorted(entries.p.unique(), key=lambda name: -entries[entries.p == name].v.sum())
    articles = sorted(entries.art.unique())
    divisions = {key: division_name(key, sitc) for key in entries.dk.unique()}

    # Aggregated rows for the plates: [direction, year, place, harbour, category, division, article, value]
    grouped = entries.groupby(['d', 'yi', 'c', 'p', 'cat', 'dk', 'art'], as_index=False).v.sum()
    rows = [[DIRECTIONS[r.d], int(r.yi), places.index(r.c), ports.index(r.p),
             int(r.cat), r.dk, articles.index(r.art), round(float(r.v), 3)]
            for r in grouped.itertuples()]

    out = dict(
        places=[dict(name=name, lon=PLACES.get(name, NO_POSITION)[0], lat=PLACES.get(name, NO_POSITION)[1],
                     rep=PLACES.get(name, NO_POSITION)[2]) for name in places],
        ports=[dict(name=name, lon=PORTS.get(name, (None, None))[0], lat=PORTS.get(name, (None, None))[1])
               for name in ports],
        cats=categories,
        divs={key: dict(name=name, label=division_label(name)) for key, name in divisions.items()},
        secs={s: sitc[s] for s in '0123456789'},
        arts=articles,
        rows=rows,
    )

    # Map positions and sea routes
    routes = json.load(open('routes.json'))
    if 'ports' in routes:
        for harbour in out['ports']:
            harbour['lon0'], harbour['lat0'] = harbour['lon'], harbour['lat']
            harbour['lon'], harbour['lat'] = routes['ports'].get(harbour['name'], (harbour['lon'], harbour['lat']))
    for place in out['places']:
        anchor = routes['anchors'].get(place['name'])   # off-map places are drawn at a sea anchor
        place['off'] = bool(anchor)
        place['ax'], place['ay'] = anchor if anchor else (place['lon'], place['lat'])
    out['routes'] = [[routes['routes'][p['name']].get(h['name']) if p['name'] in routes['routes'] else None
                      for h in out['ports']] for p in out['places']]

    # Per-entry records for Appendix B. Field order is read by the page; keep it.
    out['entries'] = [[
        DIRECTIONS[e.d],                                  # 0 direction
        int(e.yi),                                        # 1 year index
        places.index(e.c),                                # 2 place index
        ports.index(e.p),                                 # 3 harbour index
        int(e.cat),                                       # 4 category index
        e.code if isinstance(e.code, str) else '',        # 5 SITC code
        e.xr,                                             # 6 workbook row
        e.ra, e.rc, e.rh,                                 # 7-9 article, country, harbour as recorded
        e.pv,                                             # 10 value as printed (£ s d)
        round(e.wv, 4),                                   # 11 workbook Value (£)
        round(e.v, 4),                                    # 12 value used
        e.pg,                                             # 13 page
        re.sub(r'^https?://www\.canadiana\.ca/view/', '', e.src) if e.src else '',   # 14 Canadiana link
        e.qty,                                            # 15 quantity
        articles.index(e.art),                            # 16 article index
        e.dk,                                             # 17 division key
    ] for e in entries.itertuples()]

    out['years'] = [int(y) for y in years]

    # Names for SITC groups (3 digits) and subgroups (4 digits) used by Plate C
    out['sitc'] = {}
    for code in entries.code.dropna():
        for length in (3, 4):
            if len(code) >= length:
                out['sitc'][code[:length]] = sitc.get(code[:length], '')

    out['source'] = {'file': os.path.basename(workbook)}

    # Appendix C: entries summed per harbour-year against the printed totals
    imports = entries[entries.d == 'Imports']
    out['recon'] = [[year, harbour, round(pounds, 4),
                     round(float(imports[(imports.y == year) & (imports.p == harbour)].v.sum()), 4), text, row]
                    for (year, harbour), (pounds, text, row) in sorted(read_printed_totals(workbook).items())]

    json.dump(out, open('data.json', 'w'), separators=(',', ':'))
    print(f"entries {len(out['entries'])}, rows {len(rows)}, printed totals {len(out['recon'])}, "
          f"data.json {os.path.getsize('data.json'):,} bytes")
    print('Value by direction and category:')
    for (direction, cat), value in entries.groupby(['d', 'cat']).v.sum().items():
        print(f'  {direction:8} {categories[cat]["label"]:40} £{value:>12,.2f}')


if __name__ == '__main__':
    main()
