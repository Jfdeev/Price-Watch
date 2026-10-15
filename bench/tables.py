import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "complexidade" / "dados"

FILES = {
    "F1": "f1_upsert_lote.csv",
    "F2": "f2_produtos_excluidos.csv",
    "F2b": "f2_busca_completa.csv",
    "F3": "f3_create_product.csv",
    "F4": "f4_favorito_produto.csv",
    "F5": "f5_favoritos_pagina.csv",
    "F6": "f6_produtos_locais.csv",
    "F7": "f7_dashboard_metrics.csv",
    "F8": "f8_build_history_series.csv",
}


def read(code):
    with (DATA / FILES[code]).open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def fmt_ms(value):
    if value is None:
        return "—"
    if value >= 100:
        return f"{value:,.0f}".replace(",", ".")
    if value >= 10:
        return f"{value:.1f}".replace(".", ",")
    return f"{value:.2f}".replace(".", ",")


def fmt_int(value):
    if value is None:
        return "—"
    return f"{int(round(value)):,}".replace(",", ".")


def slope(points):
    if len(points) < 2:
        return None
    (n1, t1), (n2, t2) = points[-2], points[-1]
    if t1 <= 0 or t2 <= 0:
        return None
    return math.log(t2 / t1) / math.log(n2 / n1)


def linear_fit(points):
    if len(points) < 3:
        return None
    xs = [n for n, _ in points]
    ys = [t for _, t in points]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    sxx = sum((x - mean_x) ** 2 for x in xs)
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    b = sxy / sxx
    a = mean_y - b * mean_x
    ss_tot = sum((y - mean_y) ** 2 for y in ys)
    ss_res = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return a, b, r2


def fmt_fit(fit):
    if fit is None:
        return "—"
    a, b, r2 = fit
    text = f"a = {a:.2f} ms, b = {b * 1000:.4f} µs por unidade de n, R² = {r2:.3f}"
    return text.replace(".", ",")


def fmt_slope(value):
    return "—" if value is None else f"{value:.2f}".replace(".", ",")


def table(rows, extra_columns):
    by_version = defaultdict(dict)
    for row in rows:
        by_version[row["versao"]][int(float(row["n"]))] = row
    sizes = sorted(set(by_version["antes"]) | set(by_version["depois"]))
    header = ["n", "antes (ms)", "depois (ms)", "antes ÷ depois"]
    for column, label in extra_columns:
        header += [f"{label} antes", f"{label} depois"]
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for size in sizes:
        before = by_version["antes"].get(size)
        after = by_version["depois"].get(size)
        before_ms = float(before["mediana_ms"]) if before else None
        after_ms = float(after["mediana_ms"]) if after else None
        ratio = f"{before_ms / after_ms:.1f}".replace(".", ",") + "×" if before_ms and after_ms else "—"
        cells = [fmt_int(size), fmt_ms(before_ms), fmt_ms(after_ms), ratio]
        for column, _ in extra_columns:
            cells.append(fmt_int(float(before[column])) if before else "—")
            cells.append(fmt_int(float(after[column])) if after else "—")
        lines.append("| " + " | ".join(cells) + " |")
    slopes = []
    fits = []
    for version in ("antes", "depois"):
        points = sorted((n, float(row["mediana_ms"])) for n, row in by_version[version].items())
        slopes.append(f"{version}: {fmt_slope(slope(points))}")
        fits.append(f"- {version}: {fmt_fit(linear_fit(points))}")
    lines.append("")
    lines.append(
        "Inclinação no log-log entre os dois maiores n medidos (tempo): " + "; ".join(slopes) + "."
    )
    lines.append("")
    lines.append("Ajuste linear t(n) = a + b·n por mínimos quadrados sobre todos os pontos:")
    lines.append("")
    lines.extend(fits)
    return "\n".join(lines)


def render(code):
    rows = read(code)
    extra = []
    if "consultas" in rows[0]:
        extra.append(("consultas", "consultas"))
    if "bytes" in rows[0]:
        extra.append(("bytes", "bytes"))
    scenarios = sorted({row.get("cenario") for row in rows if row.get("cenario")})
    if len(scenarios) > 1:
        parts = []
        for scenario in scenarios:
            parts.append(f"**Cenário `{scenario}`**\n\n" + table([r for r in rows if r["cenario"] == scenario], extra))
        return "\n\n".join(parts)
    return table(rows, extra)


if __name__ == "__main__":
    codes = sys.argv[1:] or list(FILES)
    for code in codes:
        print(f"### {code}\n")
        print(render(code))
        print()
