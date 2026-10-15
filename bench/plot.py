import csv
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "complexidade" / "dados"
OUT = ROOT / "docs" / "complexidade" / "graficos"

COLORS = {"antes": "#eb6834", "depois": "#2a78d6"}
MARKERS = {"antes": "o", "depois": "s"}
LABELS = {"antes": "antes", "depois": "depois"}
TEXT = "#0b0b0b"
MUTED = "#52514e"
GRID = "#e4e3df"
SURFACE = "#fcfcfb"

FUNCTIONS = {
    "f1_upsert_lote.csv": ("F1", "searchProducts: upsert dos produtos da SerpApi", "n = produtos retornados pela SerpApi"),
    "f2_produtos_excluidos.csv": ("F2", "searchProducts: URLs de produtos excluídos", "D = produtos excluídos no banco (página com 24 itens)"),
    "f2_busca_completa.csv": ("F2b", "searchProducts completo com D excluídos", "D = produtos excluídos no banco (página com 24 itens)"),
    "f3_create_product.csv": ("F3", "createProduct: validação da loja", "S = lojas no banco (90% ativas)"),
    "f4_favorito_produto.csv": ("F4", "ProductDetailPage: favorito do produto", "F = favoritos do usuário"),
    "f5_favoritos_pagina.csv": ("F5", "HomePage: favoritos da página", "F = favoritos do usuário (8 produtos na página)"),
    "f6_produtos_locais.csv": ("F6", "searchProducts: produtos locais", "L = produtos locais que casam com a busca"),
    "f7_dashboard_metrics.csv": ("F7", "DashboardPage: métricas", "n = h + a + f (histórico + alertas + favoritos)"),
    "f8_build_history_series.csv": ("F8", "buildHistorySeries", "h = entradas do histórico"),
}

SCENARIO_TITLES = {
    "aleatorio": "entrada aleatória",
    "decrescente": "entrada decrescente (contrato da API)",
    "decrescente_com_empates": "decrescente com 30% de empates",
}


def read_rows(path):
    with path.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def series(rows, metric, scenario=None):
    grouped = defaultdict(list)
    for row in rows:
        if scenario is not None and row.get("cenario") != scenario:
            continue
        grouped[row["versao"]].append((float(row["n"]), float(row[metric])))
    return {version: sorted(points) for version, points in grouped.items()}


def style_axis(axis, title, xlabel, ylabel, log):
    axis.set_facecolor(SURFACE)
    axis.set_title(title, color=TEXT, fontsize=10, loc="left")
    axis.set_xlabel(xlabel, color=MUTED, fontsize=9)
    axis.set_ylabel(ylabel, color=MUTED, fontsize=9)
    axis.tick_params(colors=MUTED, labelsize=8)
    axis.grid(True, color=GRID, linewidth=0.8)
    for side in ("top", "right"):
        axis.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        axis.spines[side].set_color(GRID)
    axis.set_xscale("log")
    if log:
        axis.set_yscale("log")


def draw(axis, data, label_last):
    for version in ("antes", "depois"):
        points = data.get(version)
        if not points:
            continue
        xs = [point[0] for point in points]
        ys = [max(point[1], 1e-6) for point in points]
        axis.plot(
            xs,
            ys,
            color=COLORS[version],
            marker=MARKERS[version],
            markersize=6,
            linewidth=2,
            markeredgecolor=SURFACE,
            markeredgewidth=1.5,
            label=LABELS[version],
        )
        if label_last:
            axis.annotate(
                LABELS[version],
                (xs[-1], ys[-1]),
                xytext=(6, 0),
                textcoords="offset points",
                color=TEXT,
                fontsize=8,
                va="center",
            )


def save(figure, name):
    OUT.mkdir(parents=True, exist_ok=True)
    figure.patch.set_facecolor(SURFACE)
    figure.tight_layout()
    figure.savefig(OUT / name, dpi=150, facecolor=SURFACE)
    plt.close(figure)
    print(OUT / name)


def plot_metric(rows, code, title, xlabel, metric, ylabel, suffix):
    figure, axes = plt.subplots(1, 2, figsize=(11, 4))
    data = series(rows, metric)
    style_axis(axes[0], f"{code} · {title} · escala x log", xlabel, ylabel, log=False)
    axes[0].set_xscale("log")
    draw(axes[0], data, True)
    style_axis(axes[1], f"{code} · log-log (inclinação = expoente)", xlabel, ylabel, log=True)
    draw(axes[1], data, False)
    axes[0].legend(frameon=False, fontsize=8, labelcolor=TEXT)
    save(figure, f"{code.lower()}_{suffix}.png")


def plot_linear(rows, code, title, xlabel):
    figure, axes = plt.subplots(1, 2, figsize=(11, 4))
    data = series(rows, "mediana_ms")
    style_axis(axes[0], f"{code} · {title} · eixos lineares", xlabel, "tempo mediano (ms)", log=False)
    axes[0].set_xscale("linear")
    draw(axes[0], data, True)
    style_axis(axes[1], f"{code} · log-log (inclinação = expoente)", xlabel, "tempo mediano (ms)", log=True)
    draw(axes[1], data, False)
    axes[0].legend(frameon=False, fontsize=8, labelcolor=TEXT)
    save(figure, f"{code.lower()}_tempo.png")


def plot_scenarios(rows, code, title, xlabel):
    scenarios = [name for name in SCENARIO_TITLES if any(row.get("cenario") == name for row in rows)]
    figure, axes = plt.subplots(2, len(scenarios), figsize=(5 * len(scenarios), 7.5), squeeze=False)
    for column, scenario in enumerate(scenarios):
        data = series(rows, "mediana_ms", scenario)
        style_axis(axes[0][column], f"{code} · {SCENARIO_TITLES[scenario]}", xlabel, "tempo mediano (ms)", log=False)
        axes[0][column].set_xscale("linear")
        draw(axes[0][column], data, True)
        style_axis(axes[1][column], "log-log", xlabel, "tempo mediano (ms)", log=True)
        draw(axes[1][column], data, False)
    axes[0][0].legend(frameon=False, fontsize=8, labelcolor=TEXT)
    figure.suptitle(f"{code} · {title}", color=TEXT, fontsize=11, x=0.01, ha="left")
    save(figure, f"{code.lower()}_tempo.png")


def main():
    missing = []
    for file_name, (code, title, xlabel) in FUNCTIONS.items():
        path = DATA / file_name
        if not path.exists():
            missing.append(file_name)
            continue
        rows = read_rows(path)
        if "cenario" in rows[0] and len({row["cenario"] for row in rows}) > 1:
            plot_scenarios(rows, code, title, xlabel)
        else:
            plot_linear(rows, code, title, xlabel)
        if "consultas" in rows[0]:
            plot_metric(rows, code, title, xlabel, "consultas", "consultas SQL por chamada", "consultas")
        if "bytes" in rows[0]:
            plot_metric(rows, code, title, xlabel, "bytes", "bytes do JSON transferido", "bytes")
    if missing:
        print("CSV ausente: " + ", ".join(missing), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
