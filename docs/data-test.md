# Data test (master PRD section 8)

Run on 10 Oct 2026, about 17:00 UTC. Raw responses are in `shared/fixtures/raw/`.

| Check | Answer | Evidence |
| --- | --- | --- |
| OpenAQ: Delhi stations with PM2.5, PM10, NO2 and CO, each fresh in the last 3 hours | **0.** 98 locations in the Delhi box. About 40 CPCB/DPCC stations carry all four pollutants, but every one last reported at 2026-10-07 14:30 UTC, **74 hours stale**. The only fresh locations (6) are low-cost AirGradient sensors and the US Embassy monitor, none with all four pollutants | `openaq-locations-delhi.json`, `openaq-latest-anand-vihar.json` |
| OpenAQ: hourly history for the last 14 days | **Yes, up to 7 Oct.** Anand Vihar PM2.5: 250 hourly rows from 26 Sep to 7 Oct 13:30 UTC. Early Nov 2025: 386 of 432 hours, peak 546 µg/m³, values move hour to hour (e.g. 228 then 114), so they are truly hourly | `openaq-hours-anand-vihar-pm25.json`, `openaq-hours-anand-vihar-pm25-nov2025.json` |
| CPCB feed: key works; values hourly or 24-hour average | **Not run: no `DATA_GOV_API_KEY` yet** | |
| Open-Meteo: `boundary_layer_height` and `precipitation` for Delhi | **Yes, both.** Forecast: 72 hourly rows, no nulls. Archive (Nov 2025): no nulls, BLH present | `openmeteo-forecast.json`, `openmeteo-archive.json` |
| FIRMS: detections in box 73,28,78,33 for the last 2 days | **167** (VIIRS_SNPP_NRT). For the replay period, VIIRS_SNPP_SP covers to 2026-06-30: **2,745** detections in 1-5 Nov 2025 | `firms-viirs-snpp-nrt-2d.csv`, `firms-viirs-snpp-sp-2025-11-01.csv`, `firms-data-availability.csv` |

## Notes for the adapters

- OpenAQ locations keep legacy sensors (some last reported in 2016-2018) next to the current ones. The adapter picks, per pollutant, the sensor with the newest reading and falls back to older ones when a sensor has no rows for the period.
- OpenAQ hourly periods start at :30 UTC (Indian clock hours). The adapter floors them to the start of the UTC hour.
- Current CO sensors report mg/m³ (older ones µg/m³). Only current sensors are used, and the engine compares each station with its own baseline, so units stay consistent per station.
- FIRMS `acq_time` is unpadded (`741` = 07:41 UTC). The SP CSV has an extra `type` column; the parser reads columns by name.

## Chosen readings source

Decision rule: "OpenAQ stale but history present: use the CPCB feed for live data and OpenAQ for backfill."

- **Backfill and replay: OpenAQ** (A1.2 built).
- **Live: CPCB feed**, pending `DATA_GOV_API_KEY` (A1.3). Until then live ingest stays on OpenAQ, which returns nothing newer than 7 Oct.
- If the CPCB feed turns out to be a 24-hour average, the demo runs on the replay dataset, labelled on screen (cut rule in master PRD section 12).

## Stations

17 stations in `shared/src/stations.json`: the 13 hotspots plus Lodhi Road, ITO, Mandir Marg and Sirifort for comparison. Every one matches a CPCB location on OpenAQ with all four pollutants; coordinates and `openaqLocationId` come from the locations response. Where a name had two OpenAQ locations, the one with the newest reading was kept.

## Threshold changes

None yet.
