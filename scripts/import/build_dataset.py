"""One-off importer that produced data/materials/*.json (the versioned source of truth).

Inputs (local caches, not committed):
  data/raw/sheet_lista_materialow.csv  - export of the project Google Sheet, tab 'Lista materiałów'
  data/raw/pb_materials.json           - https://api.physicallybased.info/materials (CC0)
  $PAGES_DIR/*.txt                      - headless-browser text captures of MakeItFrom / Wood Database pages

Rules: never invent values. A numeric field is filled only when it can be traced to a URL in
metadata.sources. Sheet numbers are kept verbatim under `sheet_indicative` and flagged unverified.
"""
import csv, json, os, re, sys, pathlib, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from parse_makeitfrom import parse as parse_mif

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGES = pathlib.Path(os.environ.get("PAGES_DIR", "/workspace/scraper/pages"))
OUT = ROOT / "data" / "materials"
TODAY = "2026-11-17"
ACCESSED = TODAY
SHEET_URL = "https://docs.google.com/spreadsheets/d/15C3IX_kksamelzdgQV4xVeS4bFz43IvbXxgz1zXnwxc"

CATEGORY_EN = {
    "Kompozyt": "Composite", "Rdzeń": "Core", "Metal": "Metal", "Włókno": "Fibre", "Żywica": "Resin",
    "Powłoka": "Coating", "Drewno": "Wood", "Inne": "Other", "Izolacja": "Insulation",
    "Uszczelnienie": "Sealant", "Szkło": "Glass", "Tworzywo": "Plastic", "Ochrona": "Cathodic protection",
    "Takielunek": "Rigging", "Naturalny": "Natural", "Pokład": "Decking", "Guma": "Rubber", "Klej": "Adhesive",
}
CONF_EN = {"Wysoki": "high", "Średni": "medium", "Niski": "low"}

# English display names for Polish sheet names (translation only, no data)
NAME_EN = {
 "MAT-001":"GFRP laminate, typical (glass/epoxy 0/90)","MAT-002":"GFRP single skin (glass/polyester)",
 "MAT-003":"CFRP carbon laminate","MAT-004":"Sandwich GFRP + PVC core","MAT-010":"PVC foam core (Divinycell H60–H100)",
 "MAT-011":"PET foam core","MAT-012":"Balsa core","MAT-013":"Honeycomb Nomex / aramid","MAT-020":"Aluminium 5083",
 "MAT-021":"Aluminium 6082","MAT-022":"Stainless steel 316","MAT-023":"Stainless steel 316L","MAT-024":"Carbon steel (hull plate)",
 "MAT-030":"E-glass fibre","MAT-031":"Carbon fibre, standard modulus (HS)","MAT-032":"Basalt fibre","MAT-033":"Epoxy resin",
 "MAT-034":"Polyester resin","MAT-035":"Vinyl ester resin","MAT-040":"Gelcoat","MAT-041":"Antifouling paint",
 "MAT-042":"Marine varnish / clear coat","MAT-050":"Teak","MAT-051":"Marine plywood","MAT-052":"EPDM rubber / seals",
 "MAT-060":"GFRP CSM laminate (chopped strand mat)","MAT-061":"GFRP gelcoat + hand lay-up laminate","MAT-062":"CFRP carbon prepreg",
 "MAT-082":"Marine bronze (silicon bronze C65500)","MAT-083":"Brass","MAT-084":"Titanium Grade 2","MAT-085":"Duplex stainless steel",
 "MAT-090":"Aramid fibre (Kevlar)","MAT-091":"S-glass fibre","MAT-092":"Carbon fibre, high modulus (HM)","MAT-093":"Flax fibre",
 "MAT-100":"Bio-based epoxy resin","MAT-101":"Thermoplastic resin (Elium)","MAT-102":"Polyurethane resin",
 "MAT-110":"Marine epoxy paint","MAT-111":"Polyurethane paint","MAT-112":"Epoxy primer","MAT-113":"Marine alkyd paint",
 "MAT-114":"Anti-slip coating","MAT-120":"Mahogany","MAT-121":"Oak","MAT-122":"Bamboo","MAT-123":"Okoume plywood",
 "MAT-130":"Closed-cell PU foam","MAT-131":"Marine mineral wool","MAT-132":"Marine silicone","MAT-133":"Polyurethane sealant",
 "MAT-140":"Tempered marine glass","MAT-141":"Polycarbonate","MAT-142":"Acrylic (PMMA)","MAT-150":"Zinc anode",
 "MAT-151":"Aluminium anode","MAT-152":"Dyneema rope","MAT-153":"Polyester rope","MAT-154":"Stainless steel 304","MAT-155":"Copper",
 "MAT-170":"Hard bottom paint","MAT-171":"Ablative bottom paint","MAT-172":"Marine varnish","MAT-180":"Stainless steel 2205 duplex",
 "MAT-182":"Aluminium 5086","MAT-183":"Phosphor bronze","MAT-190":"Natural cork","MAT-191":"Hemp fibre","MAT-192":"Bio-polyester resin",
 "MAT-193":"Bio-based foam","MAT-200":"Stainless steel bar","MAT-201":"Anodised aluminium","MAT-202":"Deck textile (EVA)",
 "MAT-204":"Synthetic teak","MAT-211":"XPS foam","MAT-212":"EPS foam","MAT-231":"Rigid PVC","MAT-232":"Nylon (PA)",
 "MAT-233":"PTFE (Teflon)","MAT-260":"Aluminium 5754","MAT-261":"Aluminium 7075","MAT-262":"Stainless steel 904L",
 "MAT-264":"Copper-nickel 90/10","MAT-265":"Copper-nickel 70/30",
}

def slugify(s):
    s = s.replace("–", "-").replace("—", "-")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-+", "-", s)

def num_range(raw):
    raw = (raw or "").strip()
    if not raw or raw in ("—", "-"):
        return None
    m = re.match(r"^([0-9.]+)\s*[–-]\s*([0-9.]+)$", raw)
    if m:
        return {"min": float(m.group(1)), "max": float(m.group(2))}
    m = re.match(r"^([0-9.]+)$", raw)
    if m:
        return {"value": float(m.group(1))}
    return {"raw": raw}

# ---------------- Sources registry ----------------
SOURCES = {}
def src(sid, label, url, kind, license_=None):
    SOURCES[sid] = {"id": sid, "label": label, "url": url, "type": kind, "accessed": ACCESSED, **({"license": license_} if license_ else {})}
    return sid

MIF = "https://www.makeitfrom.com/material-properties/"
def mif(sid, page, label):
    return src(sid, f"MakeItFrom.com – {label}", MIF + page, "engineering")
def mif_file(page):
    return PAGES / (page.replace(".", "_") + ".txt")

PB_API = "https://api.physicallybased.info/materials"
pb = {m["name"]: m for m in json.load(open(ROOT / "data/raw/pb_materials.json"))}

def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

def pb_appearance(name, proxy_note=None):
    m = pb[name]
    sid = src("pb-" + slugify(name), f"Physically Based – {name}", f"https://physicallybased.info/?search={name.replace(' ', '+')}", "appearance", "CC0-1.0")
    lin = [round(x, 4) for x in m["color"]]
    srgb = [round(lin_to_srgb(x), 4) for x in lin]
    hexv = "#" + "".join(f"{round(x*255):02x}" for x in srgb)
    p = {
        "base_color": {"linear": lin, "srgb": srgb, "hex": hexv, "source": sid},
        "base_metalness": {"value": m["metalness"], "source": sid},
        "specular_roughness": {"value": m["roughness"], "source": sid, "note": "Physically Based reference value (clean/polished sample); real surfaces are usually rougher."},
        "specular_ior": {"value": m["ior"], "source": sid},
    }
    if m.get("specularColor"):
        sc = [round(x, 4) for x in m["specularColor"]]
        p["specular_color"] = {"linear": sc, "source": sid, "note": "F82 tint (OpenPBR specular_color for metals)"}
    if m.get("transmission") is not None:
        p["transmission_weight"] = {"value": m["transmission"], "source": sid}
    if m.get("complexIor"):
        p["complex_ior"] = {"value": m["complexIor"], "source": sid, "note": "n,k pairs for R,G,B as published by Physically Based"}
    ref = (m.get("reference") or [None])[0]
    return {"openpbr": p, "reference_render": ref, "pb_name": name, **({"proxy_note": proxy_note} if proxy_note else {}), "upstream_sources": m.get("sources", [])}

def tag(d, sid, note=None):
    out = {}
    for k, v in d.items():
        v = dict(v); v["source"] = sid
        if note: v.setdefault("note", note)
        out[k] = v
    return out

# --------------- Curated engineering + appearance mapping ---------------
CUR = {}
def cur(mid, **kw):
    CUR.setdefault(mid, {}).update(kw)

def mif_eng(mid, page, label, keep=None, note=None, drop=("refractive_index",)):
    f = mif_file(page)
    vals = parse_mif(f.read_text())
    sid = mif("mif-" + slugify(label), page, label)
    vals = {k: v for k, v in vals.items() if k not in drop and (keep is None or k in keep)}
    CUR.setdefault(mid, {}).setdefault("engineering", {}).update(tag(vals, sid, note))
    return sid, parse_mif(f.read_text())

# Metals
for mid, page, label in [
    ("MAT-020", "5083-AlMg4.5Mn0.7-3.3547-N8-A95083-Aluminum", "5083 aluminium (all tempers)"),
    ("MAT-021", "6082-AlSi1MgMn-3.2315-H30-A96082-Aluminum", "6082 aluminium (all tempers)"),
    ("MAT-080", "5052-AlMg2.5-3.3523-A95052-Aluminum", "5052 aluminium (all tempers)"),
    ("MAT-081", "6061-AlMg1SiCu-3.3214-H20-A96061-Aluminum", "6061 aluminium (all tempers)"),
    ("MAT-182", "5086-AlMg4-3.3545-A95086-Aluminum", "5086 aluminium (all tempers)"),
    ("MAT-260", "5754-AlMg3-3.3535-A95754-Aluminum", "5754 aluminium (all tempers)"),
    ("MAT-261", "7075-AlZn5.5MgCu-3.4365-2L95-A97075-Aluminum", "7075 aluminium (all tempers)"),
]:
    mif_eng(mid, page, label, note="Range spans all tempers listed on the source page.")
    cur(mid, appearance=pb_appearance("Aluminum", "Pure aluminium optical data used for the alloy (alloying shifts colour only slightly)."))

for mid, page, label in [
    ("MAT-022", "AISI-316-S31600-Stainless-Steel", "AISI 316 stainless (all conditions)"),
    ("MAT-023", "AISI-316L-S31603-Stainless-Steel", "AISI 316L stainless (all conditions)"),
    ("MAT-154", "AISI-304-S30400-Stainless-Steel", "AISI 304 stainless (all conditions)"),
    ("MAT-085", "UNS-S32205-Stainless-Steel", "UNS S32205 (2205) duplex stainless"),
    ("MAT-180", "UNS-S32205-Stainless-Steel", "UNS S32205 (2205) duplex stainless"),
    ("MAT-262", "UNS-N08904-904L-Stainless-Steel", "UNS N08904 (904L) superaustenitic stainless"),
]:
    mif_eng(mid, page, label, note="Range spans annealed to cold-worked conditions listed on the source page.")
    cur(mid, appearance=pb_appearance("Stainless Steel", "Generic stainless steel optical data."))

mif_eng("MAT-024", "ASTM-A36-SS400-S275-Structural-Carbon-Steel", "ASTM A36 / S275 structural carbon steel",
        note="Proxy: structural carbon steel A36/S275; classed hull-plate grades (e.g. DNV/ABS Grade A) have similar but not identical specs.")
cur("MAT-024", appearance=pb_appearance("Iron", "Pure iron optical data used as a proxy for bare carbon steel."))
mif_eng("MAT-084", "Grade-2-3.7035-R50400-Titanium", "Grade 2 titanium (R50400)")
cur("MAT-084", appearance=pb_appearance("Titanium"))
mif_eng("MAT-082", "UNS-C65500-CW116C-Silicon-Bronze", "UNS C65500 high-silicon bronze",
        note="Sheet entry 'Brąz morski' (marine bronze) interpreted as silicon bronze C65500, the common marine fastener bronze.")
mif_eng("MAT-083", "UNS-C26000-CW505L-Cartridge-Brass", "UNS C26000 cartridge brass (70/30)")
cur("MAT-083", appearance=pb_appearance("Brass"))
mif_eng("MAT-183", "UNS-C51000-CW451K-Phosphor-Bronze", "UNS C51000 phosphor bronze")
mif_eng("MAT-155", "UNS-C11000-CW004A-Electrolytic-Tough-Pitch-Copper", "UNS C11000 ETP copper")
cur("MAT-155", appearance=pb_appearance("Copper"))
mif_eng("MAT-264", "UNS-C70600-CW352H-Copper-Nickel", "UNS C70600 90/10 copper-nickel")
mif_eng("MAT-265", "UNS-C71500-CW354H-Copper-Nickel", "UNS C71500 70/30 copper-nickel")
mif_eng("MAT-181", "Monel-400-NiCu30Fe-2.4360-N04400-NA13", "Monel 400 (N04400)")
mif_eng("MAT-263", "Nickel-Alloy-625-N06625-NA21", "Inconel / nickel alloy 625 (N06625)",
        note="Sheet entry 'Inconel' mapped to alloy 625, the common marine Inconel grade.")

# Anodes: appearance + density only from Physically Based
for mid, name in [("MAT-150", "Zinc"), ("MAT-340", "Zinc"), ("MAT-151", "Aluminum"), ("MAT-341", "Aluminum"), ("MAT-342", "Magnesium")]:
    a = pb_appearance(name, "Pure-metal optical data; anode alloys differ slightly.")
    cur(mid, appearance=a)
    sid = a["openpbr"]["base_color"]["source"]
    CUR[mid].setdefault("engineering", {})["density"] = {"value": float(pb[name]["density"]), "unit": "kg/m³", "source": sid, "note": "Pure metal density."}

# Plastics
for mid, page, label, pbname in [
    ("MAT-141", "Polycarbonate-PC", "Polycarbonate (PC)", "Plastic (PC)"),
    ("MAT-142", "Polymethylmethacrylate-PMMA-Acrylic", "PMMA (acrylic)", "Plastic (Acrylic)"),
    ("MAT-231", "Unplasticized-Rigid-Polyvinyl-Chloride-uPVC-PVC-U", "Rigid PVC (uPVC)", "Plastic (PVC)"),
    ("MAT-230", "High-Density-Polyethylene-HDPE", "HDPE", None),
    ("MAT-370", "Ultra-High-Molecular-Weight-Polyethylene-UHMW-PE", "UHMW-PE", None),
    ("MAT-371", "Acetal-Homopolymer-POM-H", "Acetal homopolymer (POM-H)", None),
    ("MAT-232", "Polyamide-PA-Nylon-6", "Polyamide 6 (nylon 6)", None),
    ("MAT-233", "Polytetrafluoroethylene-PTFE", "PTFE", None),
]:
    sid, allv = mif_eng(mid, page, label)
    if pbname:
        a = pb_appearance(pbname, "Clear, unpigmented polymer.")
        cur(mid, appearance=a)
    elif "refractive_index" in allv:
        ri = allv["refractive_index"]
        cur(mid, appearance={"openpbr": {"specular_ior": {**ri, "unit": "", "source": sid}}})

# Glazing (appearance from Physically Based; engineering only where a source exists above)
for mid, name, note in [("MAT-140", "Glass", "Soda-lime glass optical data; tempering does not change appearance."),
                        ("MAT-320", "Glass", "Soda-lime glass optical data; laminated interlayer not modelled."),
                        ("MAT-321", "Plastic (Acrylic)", "Clear PMMA optical data."),
                        ("MAT-322", "Plastic (PC)", "Clear polycarbonate optical data; multiwall geometry not modelled.")]:
    a = pb_appearance(name, note)
    cur(mid, appearance=a)
    if name == "Glass":
        CUR[mid].setdefault("engineering", {})["density"] = {"value": float(pb[name]["density"]), "unit": "kg/m³", "source": a["openpbr"]["base_color"]["source"], "note": "Soda-lime glass"}

# Resins
mif_eng("MAT-033", "Epoxy", "Epoxy (generic cast thermoset)", note="Neat cast resin, not a laminate.")
mif_eng("MAT-034", "Unsaturated-Polyester-UP", "Unsaturated polyester (generic)", note="Neat cast resin, not a laminate.")
for mid in ("MAT-033", "MAT-034"):
    allv = parse_mif(mif_file("Epoxy" if mid == "MAT-033" else "Unsaturated-Polyester-UP").read_text())
    if "refractive_index" in allv:
        cur(mid, appearance={"openpbr": {"specular_ior": {**allv["refractive_index"], "unit": "", "source": "mif-" + slugify("Epoxy (generic cast thermoset)" if mid == "MAT-033" else "Unsaturated polyester (generic)")}}})

# Natural / wood (MakeItFrom)
mif_eng("MAT-190", "Cork", "Cork (natural)")

# Wood Database
WD = "https://www.wood-database.com/"
def wood(mid, slug, label, note=None):
    t = (PAGES / f"wood-{slug}.txt").read_text()
    sid = src("wd-" + slug, f"The Wood Database – {label}", WD + slug + "/", "engineering")
    g = lambda pat: (re.search(pat, t) or [None, None])[1]
    e = {}
    dens = g(r"Average Dried Weight:.*?\(([0-9,.]+) kg/m3\)")
    if dens: e["density"] = {"value": float(dens.replace(",", "")), "unit": "kg/m³", "note": "Average dried weight at 12% MC"}
    mod = g(r"Elastic Modulus:.*?\(([0-9,.]+) GPa\)")
    if mod: e["young_modulus"] = {"value": float(mod), "unit": "GPa", "note": "Bending (MOE), along grain"}
    mor = g(r"Modulus of Rupture:.*?\(([0-9,.]+) MPa\)")
    if mor: e["flexural_strength"] = {"value": float(mor), "unit": "MPa", "note": "Modulus of rupture"}
    cr = g(r"Crushing Strength:.*?\(([0-9,.]+) MPa\)")
    if cr: e["compressive_strength"] = {"value": float(cr), "unit": "MPa", "note": "Parallel to grain"}
    jk = g(r"Janka Hardness:.*?\(([0-9,.]+) N\)")
    if jk: e["hardness_janka"] = {"value": float(jk.replace(",", "")), "unit": "N"}
    rot = g(r"Rot Resistance: ([^\n]+)")
    out = tag(e, sid, None)
    for k in out:
        if note and "note" not in out[k]: out[k]["note"] = note
    CUR.setdefault(mid, {}).setdefault("engineering", {}).update(out)
    if rot:
        CUR[mid]["durability_note"] = {"text": rot.strip(), "source": sid}

wood("MAT-050", "teak", "Teak (Tectona grandis)")
wood("MAT-351", "teak", "Teak (Tectona grandis)", note="Solid teak species values; veneer itself not tested.")
wood("MAT-120", "honduran-mahogany", "Honduran mahogany (Swietenia macrophylla)")
wood("MAT-121", "white-oak", "White oak (Quercus alba)")
wood("MAT-123", "okoume", "Okoume (Aucoumea klaineana)", note="Solid okoume wood values; plywood panel properties differ (layup, glue).")
wood("MAT-012", "balsa", "Balsa (Ochroma pyramidale)", note="Solid balsa wood; end-grain core panels are tested perpendicular to the face.")

# Fibres
s_wgf = src("wiki-glass-fiber", "Wikipedia – Glass fiber (properties table, cites Ilschner et al., Ullmann's 2000)", "https://en.wikipedia.org/wiki/Glass_fiber", "engineering", "CC BY-SA 4.0")
cur("MAT-030", engineering={
    "tensile_strength": {"value": 3445, "unit": "MPa", "source": s_wgf, "note": "Single fibre, not laminate"},
    "compressive_strength": {"value": 1080, "unit": "MPa", "source": s_wgf},
    "young_modulus": {"value": 76.0, "unit": "GPa", "source": s_wgf},
    "density": {"value": 2580, "unit": "kg/m³", "source": s_wgf},
    "thermal_expansion": {"value": 5.4, "unit": "µm/m·K", "source": s_wgf},
    "softening_temp": {"value": 846, "unit": "°C", "source": s_wgf},
}, corrosion_note={"text": "E-glass surfaces are attacked by chloride ions; protect with a resin-rich layer / gelcoat in marine use.", "source": s_wgf})
cur("MAT-091", engineering={
    "tensile_strength": {"value": 4890, "unit": "MPa", "source": s_wgf, "note": "S-2 glass, single fibre"},
    "compressive_strength": {"value": 1600, "unit": "MPa", "source": s_wgf},
    "young_modulus": {"value": 85.5, "unit": "GPa", "source": s_wgf},
    "density": {"value": 2460, "unit": "kg/m³", "source": s_wgf},
    "thermal_expansion": {"value": 2.9, "unit": "µm/m·K", "source": s_wgf},
    "softening_temp": {"value": 1056, "unit": "°C", "source": s_wgf},
})
s_t700 = src("toray-t700s", "Toray TORAYCA T700S data sheet (Rev. 11/24/2025)", "https://www.toraycma.com/wp-content/uploads/T700S-Data-Sheet.pdf", "engineering")
cur("MAT-031", engineering={
    "tensile_strength": {"value": 4900, "unit": "MPa", "source": s_t700, "note": "T700S fibre (representative HS carbon)"},
    "young_modulus": {"value": 230, "unit": "GPa", "source": s_t700},
    "elongation_at_break": {"value": 2.1, "unit": "%", "source": s_t700},
    "density": {"value": 1800, "unit": "kg/m³", "source": s_t700},
    "thermal_expansion": {"value": -0.38, "unit": "µm/m·K", "source": s_t700, "note": "Axial CTE"},
})
cur("MAT-003", engineering={
    "tensile_strength": {"value": 2860, "unit": "MPa", "source": s_t700, "note": "T700S/epoxy UD composite, 60% Vf, 0° – strongly layup-dependent"},
    "young_modulus": {"value": 134, "unit": "GPa", "source": s_t700, "note": "UD 0°, 60% Vf; quasi-isotropic laminates are much lower"},
    "compressive_strength": {"value": 1450, "unit": "MPa", "source": s_t700, "note": "UD 0°, 60% Vf"},
    "flexural_strength": {"value": 1690, "unit": "MPa", "source": s_t700},
}, layup_note="Values are for a unidirectional T700S/epoxy laminate at 60% fibre volume. Real hull laminates (multi-axial, lower Vf) are substantially lower.")
s_kev = src("wiki-kevlar", "Wikipedia – Kevlar (properties section)", "https://en.wikipedia.org/wiki/Kevlar", "engineering", "CC BY-SA 4.0")
cur("MAT-090", engineering={
    "tensile_strength": {"value": 3000, "unit": "MPa", "source": s_kev, "note": "Spun fibre, approx."},
    "density": {"value": 1440, "unit": "kg/m³", "source": s_kev},
})
s_uhm = src("wiki-uhmwpe", "Wikipedia – Ultra-high-molecular-weight polyethylene (Dyneema SK75 fibre)", "https://en.wikipedia.org/wiki/Ultra-high-molecular-weight_polyethylene", "engineering", "CC BY-SA 4.0")
cur("MAT-152", engineering={
    "tensile_strength": {"max": 2400, "unit": "MPa", "source": s_uhm, "note": "Fibre yield strength 'as high as' 2.4 GPa; rope strength is lower (construction-dependent)"},
    "density": {"value": 970, "unit": "kg/m³", "source": s_uhm, "note": "Dyneema SK75 fibre"},
    "max_service_temp": {"value": 90, "unit": "°C", "source": s_uhm, "note": "DSM advice for long-term use"},
})

# Divinycell H (Diab datasheet rev 26, May 2026)
s_diab = src("diab-divinycell-h", "Diab Divinycell H technical data sheet, rev 26 SI (May 2026)", "https://diab-media.azureedge.net/eyajkrhd/diab-divinycell-h-may-2026-rev26-si.pdf", "engineering")
DIAB = {  # nominal values per grade: density kg/m3, comp strength MPa, comp mod MPa, tens strength MPa, tens mod MPa, shear strength MPa, shear mod MPa, thermal cond W/mK
 "H45": (48, 0.6, 50, 1.4, 55, 0.56, 15, 0.028), "H60": (60, 0.9, 70, 1.8, 75, 0.76, 20, 0.029),
 "H80": (80, 1.4, 90, 2.5, 95, 1.15, 27, 0.031), "H100": (100, 2.0, 135, 3.5, 130, 1.6, 35, 0.033),
 "H130": (130, 3.0, 170, 4.8, 175, 2.2, 50, 0.036), "H200": (200, 5.4, 310, 7.1, 250, 3.5, 73, 0.044),
}
def diab(mid, grades):
    rows = [DIAB[g] for g in grades]
    keys = [("density", "kg/m³", 1), ("compressive_strength", "MPa", 1), ("compressive_modulus", "MPa", 1), ("tensile_strength", "MPa", 1),
            ("tensile_modulus_core", "MPa", 1), ("shear_strength", "MPa", 1), ("shear_modulus", "MPa", 1), ("thermal_conductivity", "W/m·K", 1)]
    e = {}
    for i, (k, u, _) in enumerate(keys):
        vals = [r[i] for r in rows]
        e[k] = ({"value": vals[0]} if len(vals) == 1 else {"min": min(vals), "max": max(vals)})
        e[k].update({"unit": u, "source": s_diab, "note": "Nominal, " + "/".join("Divinycell " + g for g in grades) + (", perpendicular to plane" if k != "density" and k != "thermal_conductivity" else "")})
    cur(mid, engineering=e)
diab("MAT-010", ["H60", "H80", "H100"]); diab("MAT-070", ["H45"]); diab("MAT-071", ["H130"]); diab("MAT-250", ["H200"])

# ---------------- Costs (supplier listings, Easy Composites EU, NL warehouse) ----------------
EC = "https://www.easycomposites.eu/"
def ec_cost(mid, path, product, unit, mn=None, mx=None, note=None, conf="medium"):
    sid = src("ec-" + path.lower(), f"Easy Composites EU – {product}", EC + path, "cost")
    c = {"unit": unit, "currency": "EUR", "region": "EU (ships from NL)", "date": TODAY, "source": sid, "confidence": conf,
         "vat": "excl. VAT", "basis": "retail web listing"}
    if mn is not None: c["min"] = mn
    if mx is not None: c["max"] = mx
    if mn is not None and mx is not None: c["value"] = round((mn + mx) / 2, 2)
    if note: c["note"] = note
    CUR.setdefault(mid, {}).setdefault("cost", []).append(c)

ec_cost("MAT-033", "el2-epoxy-laminating-resin", "EL2 epoxy laminating resin", "EUR/kg", 17.65, 30.70, "Largest kit (from-price) to 500 g kit.")
ec_cost("MAT-281", "el2-epoxy-laminating-resin", "EL2 epoxy laminating resin", "EUR/kg", 17.65, 30.70, "Largest kit (from-price) to 500 g kit.")
ec_cost("MAT-280", "in2-epoxy-infusion-resin", "IN2 epoxy infusion resin", "EUR/kg", 18.60, None, "From-price for the largest kit; small kits cost more.", "low")
ec_cost("MAT-100", "LB2-epoxy-laminating-resin", "LB2 epoxy laminating bio resin (~35% plant-derived)", "EUR/kg", 17.49, 23.75, "Largest kit (from-price) to 1 kg kit.")
ec_cost("MAT-034", "high-quality-gp-polyester-resin", "GPX premium polyester laminating resin", "EUR/kg", 6.91, 12.50, "Largest pack (from-price) to 1 kg.")
ec_cost("MAT-035", "ve140-fuel-resistant-vinylester-fuel-tank-resin", "VE140 fuel-resistant vinylester resin", "EUR/kg", 17.10, 24.75, "Largest pack (from-price) to 1 kg; specialty fuel-tank grade.")
ec_cost("MAT-040", "clearpol-iso-npg-clear-polyester-gelcoat", "GCX clear ISO/NPG polyester spray gelcoat", "EUR/kg", 11.70, None, "From-price; clear gelcoat, pigmented gelcoats vary.", "low")
ec_cost("MAT-030", "200g-22-twill-woven-glass-cloth", "200 g/m² 2x2 twill woven E-glass cloth, 1 m wide", "EUR/m²", 3.00, 4.85, "Volume tier to single metre.")
ec_cost("MAT-272", "600g-biaxial-glass-cloth", "600 g/m² ±45° biaxial glass cloth, 1.27 m wide", "EUR/m²", 2.87, 4.29, "€3.65–5.45 per linear metre ÷ 1.27 m width.")
ec_cost("MAT-060", "450g-emulsion-bound-chopped-strand-mat-1250mm", "450 g/m² emulsion-bound chopped strand mat, 1.25 m", "EUR/m²", 2.24, 3.16, "€2.80–3.95 per linear metre ÷ 1.25 m width.")
ec_cost("MAT-270", "240g-22-twill-3k-carbon-fibre-cloth", "240 g/m² 2x2 twill 3k carbon cloth, 1.25 m", "EUR/m²", 25.20, 32.00, "Nearest listed weight (240 g) to the sheet's 200 g twill.")
ec_cost("MAT-221", "188g-plain-weave-carbon-kevlar", "188 g/m² plain weave carbon/Kevlar hybrid cloth, 1 m", "EUR/m²", 18.65, 23.80, "Volume tier to single metre.")
ec_cost("MAT-012", "end-grain-balsa", "End-grain balsa core, 150 kg/m³", "EUR/m²", 30.03, None, "From-price (thinnest sheet); thicker sheets cost more.", "low")
ec_cost("MAT-010", "easycell75-closed-cell-pvc-foam", "EasyCell75 closed-cell PVC foam, 75 kg/m³", "EUR/m²", 25.30, None, "Default thickness variant on the listing; not Divinycell brand.", "low")

# --------- Extra materials requested in the project brief but missing from the sheet ---------
EXTRA = [
    {"id": "MAT-900", "name": "Iroko", "category": "Wood", "marine_use": ["Decking", "Joinery", "Teak substitute"]},
    {"id": "MAT-901", "name": "Lead (keel ballast)", "category": "Metal", "marine_use": ["Keel ballast"]},
    {"id": "MAT-902", "name": "Grey cast iron (keel ballast)", "category": "Metal", "marine_use": ["Keel ballast"]},
]
wood("MAT-900", "iroko", "Iroko (Milicia excelsa)")
cur("MAT-901", appearance=pb_appearance("Lead"))
CUR["MAT-901"].setdefault("engineering", {})["density"] = {"value": 11340.0, "unit": "kg/m³", "source": CUR["MAT-901"]["appearance"]["openpbr"]["base_color"]["source"]}
mif_eng("MAT-902", "Grey-Cast-Iron", "Grey cast iron (generic)")
cur("MAT-902", appearance=pb_appearance("Iron", "Pure iron optical data as proxy for machined cast iron."))

# ---------------- Assemble ----------------
def build():
    rows = list(csv.reader(open(ROOT / "data/raw/sheet_lista_materialow.csv", encoding="utf-8")))
    mats = []
    seen = set()
    for i, r in enumerate(rows, start=1):
        if not r or not r[0].startswith("MAT-"):
            continue
        r = r + [""] * (10 - len(r))
        mid, name_pl, cat_pl, use, dens, ym, cost, unit, conf, notes = [x.strip() for x in r[:10]]
        mats.append({"id": mid, "name_source": name_pl, "category_pl": cat_pl, "use": use, "sheet": {
            "row": i, "density_kg_m3": num_range(dens), "young_modulus_gpa": num_range(ym), "cost": num_range(cost),
            "cost_unit": unit or None, "confidence": CONF_EN.get(conf, conf or None), "notes": notes or None}})
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.json"): f.unlink()
    written = []
    for m in mats + [{"id": e["id"], "name_source": e["name"], "category_pl": None, "category": e["category"], "use": ", ".join(e["marine_use"]), "sheet": None, "extra": True} for e in EXTRA]:
        mid = m["id"]
        name = NAME_EN.get(mid, m["name_source"])
        slug = slugify(name)
        if slug in seen: slug = slugify(name + "-" + mid)
        seen.add(slug)
        c = CUR.get(mid, {})
        eng = c.get("engineering", {})
        appearance = c.get("appearance", {"openpbr": {}})
        appearance.setdefault("pbr_maps", {k: None for k in ["basecolor", "normal", "roughness", "metallic", "height", "ao"]})
        appearance.setdefault("materialx_file", None)
        used = set()
        def walk(o):
            if isinstance(o, dict):
                if "source" in o and isinstance(o["source"], str): used.add(o["source"])
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(eng); walk(appearance); walk(c.get("cost", [])); walk(c.get("durability_note")); walk(c.get("corrosion_note"))
        srcs = [SOURCES[s] for s in sorted(used)]
        if m.get("sheet"):
            srcs.append({"id": "omdb-sheet", "label": "OMDB project sheet – 'Lista materiałów' (indicative, unverified)", "url": SHEET_URL, "type": "project", "accessed": ACCESSED})
        cat = m.get("category") or CATEGORY_EN.get(m["category_pl"], m["category_pl"])
        notes = []
        if cat == "Composite" or c.get("layup_note"):
            notes.append(c.get("layup_note") or "Composite properties depend strongly on layup, fibre volume fraction and process.")
        n_eng = sum(1 for v in eng.values() if any(k in v for k in ("value", "min", "max")))
        conf = "medium" if (n_eng >= 4 and appearance["openpbr"]) else ("low" if (n_eng or appearance["openpbr"] or c.get("cost")) else "unverified")
        rec = {
            "id": mid, "slug": slug, "name": name, "name_source": m["name_source"],
            "category": cat, "subcategory": None,
            "marine_use": [u.strip() for u in re.split(r",\s*", m["use"]) if u.strip()] if m["use"] else [],
            "appearance": appearance,
            "engineering": {**eng, "notes": " ".join(notes) or None,
                            **({"durability_note": c["durability_note"]} if "durability_note" in c else {}),
                            **({"corrosion_note": c["corrosion_note"]} if "corrosion_note" in c else {})},
            "cost": c.get("cost", []),
            "sheet_indicative": m.get("sheet"),
            "metadata": {"tags": sorted({slugify(cat), "marine"}), "sources": srcs, "confidence": conf,
                         "last_updated": TODAY, "origin": "added (requested in brief, not in sheet)" if m.get("extra") else "project sheet"},
        }
        (OUT / f"{mid.lower()}-{slug}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n")
        written.append(rec)
    (ROOT / "data" / "sources.json").write_text(json.dumps(sorted(SOURCES.values(), key=lambda s: s["id"]), ensure_ascii=False, indent=2) + "\n")
    print("materials:", len(written), "curated:", sum(1 for w in written if w["metadata"]["confidence"] != "unverified"))

build()
