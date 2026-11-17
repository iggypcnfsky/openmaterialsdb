"""Parse MakeItFrom.com page text (as captured by a headless browser) into numeric property ranges.
Raw page captures are NOT committed (third-party content); only extracted values + URLs land in data/.
"""
import re, json, sys, pathlib

FIELDS = {
    "Density": ("density", "kg/m³", 1000.0, "g/cm3"),
    "Elastic (Young's, Tensile) Modulus": ("young_modulus", "GPa", 1.0, "GPa"),
    "Poisson's Ratio": ("poisson_ratio", "", 1.0, ""),
    "Tensile Strength: Ultimate (UTS)": ("tensile_strength", "MPa", 1.0, "MPa"),
    "Tensile Strength: Yield (Proof)": ("yield_strength", "MPa", 1.0, "MPa"),
    "Elongation at Break": ("elongation_at_break", "%", 1.0, "%"),
    "Brinell Hardness": ("hardness_brinell", "HB", 1.0, ""),
    "Thermal Expansion": ("thermal_expansion", "µm/m·K", 1.0, "µm/m-K"),
    "Thermal Conductivity": ("thermal_conductivity", "W/m·K", 1.0, "W/m-K"),
    "Maximum Temperature: Mechanical": ("max_service_temp", "°C", 1.0, "°C"),
    "Water Absorption At Saturation": ("water_absorption", "%", 1.0, "%"),
    "Refractive Index": ("refractive_index", "", 1.0, ""),
}
NUM = r"-?[0-9]+(?:\.[0-9]+)?"

def parse(text):
    lines = [l.strip() for l in text.splitlines()]
    out = {}
    for i, l in enumerate(lines):
        if l in FIELDS:
            key, unit, factor, src_unit = FIELDS[l]
            # next non-empty line
            j = i + 1
            while j < len(lines) and not lines[j]:
                j += 1
            if j >= len(lines):
                continue
            v = lines[j]
            if src_unit and src_unit not in v.replace("cm3", "cm3"):
                continue
            m = re.match(rf"^({NUM})(?: to ({NUM}))?", v)
            if not m:
                continue
            a = float(m.group(1)) * factor
            b = float(m.group(2)) * factor if m.group(2) else None
            rec = {"unit": unit}
            if b is None:
                rec["value"] = round(a, 4)
            else:
                rec["min"], rec["max"] = round(a, 4), round(b, 4)
            out[key] = rec
    return out

if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, json.dumps(parse(pathlib.Path(p).read_text())))
