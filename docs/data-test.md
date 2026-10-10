# Data test (master PRD section 8)

Run on 10 Oct 2026. Raw responses are in `shared/fixtures/raw/`.

| Check | Answer | Evidence |
| --- | --- | --- |
| OpenAQ: Delhi stations with PM2.5, PM10, NO2 and CO, each fresh in the last 3 hours | Not run yet: needs `OPENAQ_API_KEY` | |
| OpenAQ: hourly history for the last 14 days | Not run yet: needs `OPENAQ_API_KEY` | |
| CPCB feed: key works; values hourly or 24-hour average | Not run yet: needs `DATA_GOV_API_KEY` | |
| Open-Meteo: `boundary_layer_height` and `precipitation` for Delhi | **Yes, both.** Forecast: 72 hourly rows, no nulls. Archive (Nov 2025): 48 rows, no nulls, BLH present | `openmeteo-forecast.json`, `openmeteo-archive.json` |
| FIRMS: detections in box 73,28,78,33 for the last 2 days | Not run yet: needs `FIRMS_MAP_KEY` | |

## Chosen readings source

Not decided yet; waits on the OpenAQ and CPCB checks.

## Threshold changes

None yet.
