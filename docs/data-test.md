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

## Replay dataset (A6.2)

`scripts/seed-replay.ts --from 2025-10-29 --to 2025-11-12`: 295-311 hourly rows per station (of 336), 505 hours of weather, 10,638 fire detections (VIIRS_SNPP_SP).

201 incidents: regional smoke 174, trapped air 17, local burning 5, traffic 5, dust 0. High 160, medium 41.

These are only **14 distinct events**: 9 city-wide farm-smoke events (16-40 stations each, median spatial share 1.0, median 534 upwind fires), 1 city-wide trapped-air event, and a few local spikes. By event, regional smoke is 9 of 14 (64%), under the 70% tuning line; by station-incident it is 87% because each city-wide event is stored once per station. Early November 2025 was the stubble peak, so this mix is plausible.

## Threshold changes

None. The tuning rule (one cause over 70%) is met only when city-wide events are counted once per station; by event it is not.

## Placebo test (A6.3), first run

Spec method (master PRD 4.7), unedited: **31 of 57 judged fake work orders wrongly marked worked (54.4%)**; 144 more were inconclusive (119 because the whole city shifted). The median net change of the judged fakes is -17%, not about 0, so the expected-fade baseline is biased for this period, not just noisy.

Checked, not adopted (pending decision):

| Variant | Judged | Wrongly worked | Median net |
| --- | --- | --- | --- |
| Spec method, threshold -15 | 57 | 31 (54%) | -17.1 |
| Spec method, threshold -40 | 57 | 10 (18%) | -17.1 |
| Same-cause baseline pool, -15 | 57 | 33 (58%) | -19.1 |
| Change minus other stations' change (difference-in-differences), -15 | 159 | 36 (23%) | +2.3 |
| Difference-in-differences, -25 | 159 | 20 (13%) | +2.3 |

Only 1 judged fake was on a local-cause incident, where real work orders would go.
