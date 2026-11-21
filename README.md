# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/baijorl21/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/baijorl21/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: `solve.js` returns exactly csv-reader's reading `{columns, rows, errors}` of every `{text, header}` input — same broken-row policy (BOM, stray CRs, quote junk, unterminated quotes, short/long rows, line/row error records) — but parses with slice-based scanning instead of building each field a character at a time. On the kit's practice set (6 cases, ~10.2M characters) it runs about 8.5× faster than the reference in local CPU-time measurements. `main.ts` is the harness driver: it reads `/input/cases.json` and writes `/output/answers.json`.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=<dir-with-cases.json> MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r9wmade1&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
