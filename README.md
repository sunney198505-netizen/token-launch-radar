# Token Radar — model radar-2

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun)
[![rank](https://make.fun/badge/token-radar-01/sunney198505-netizen/token-launch-radar/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/token-radar-01/sunney198505-netizen/token-launch-radar/reward.svg)](https://make.fun)

Build the best token launch radar: a Node 22 program that reads a sealed
DefiLlama snapshot, ranks the pre-token protocols by implied value, and writes
a static dashboard a reader can use.

## The model (radar-2)

`implied = TVL × category multiple × growth × maturity × breadth`

- **Category multiple**: the median mcap / TVL of the snapshot's own live-token
  protocols in the category (≥3 samples, else the global median), clamped
  0.05–1.50. Learned from the same snapshot the board reads — no protocol
  name is ever special-cased.
- **Growth**: `1 + clamp(change_7d, -60, 120) / 100 × 0.5`
- **Maturity**: `0.6 + min(age_days, 1095) / 1095 × 0.4` (age unknown: 365)
- **Breadth**: `1 + 0.03 × min(chains − 1, 5)`

The board covers all 40 watchlist protocols plus the 160 pre-token protocols
below the $50M floor with the most TVL — 200 rows. Each row carries a 7-step
farm plan with costs and times, derived from the protocol's category, chains,
TVL and age. Live-token protocols are shown apart, at the market's own value.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to
the output directory, and `dossier.json` with the vendored make.fun library.

## Layout

- `main.ts` — entrypoint: read snapshot, build board, write outputs + dossier
- `lib/model.ts` — the radar-2 model, farm plans, snapshot parsing, board checks
- `dashboard/` — the static page (index.html, app.css, app.js); no network
- `screenshots/` — the board, a detail view and a filtered view
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte
