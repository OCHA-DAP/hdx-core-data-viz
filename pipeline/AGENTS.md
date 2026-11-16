# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
uv sync                  # install deps
uv run -m pipeline       # run ETL pipeline
uv run ruff check .      # lint (auto-fix enabled)
uv run ruff format .     # format
```

No tests yet.

## Architecture

Four-module ETL: `config.ENDPOINTS → extract.fetch_endpoint() → load.write_parquet() → index.build_catalog()`

- **config.py** — all constants and the endpoint registry. Add new datasets here.
- **extract.py** — paginates HAPI via `offset`/`limit` until a short page, returns `list[dict]`.
- **load.py** — writes ZSTD-15 Parquet to `catalog/<theme>/<name>.parquet`; extracts temporal range for catalog.
- **index.py** — writes `output/index.parquet` with one row per endpoint (schema, row count, temporal range).

## Notes

- Ruff runs with `lint.select = ["ALL"]`; docstrings are required on all public symbols.
- `APP_IDENTIFIER` in config.py is a base64 `email:app_name` tracking token (not auth). Update `EMAIL`/`APP_NAME` before production use.
