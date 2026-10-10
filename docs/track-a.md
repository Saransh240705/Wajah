# Wajah: Track A PRD, backend, agent and AWS (Saransh)

Oct 10, 2026 · @Saransh

Track A builds everything behind the API: data ingest, spike detection, diagnosis, work orders, effect measurement, the Step Functions workflow, the Strands agent and the AWS stack. Give this to Claude Code together with the master PRD, which holds the types, API contract and rules.

## What changed in version 2

Version 2 was written at 16:30 on 10 October. Hours in sections 5 to 9 count from that pivot.

| Area | Keep | Change | Remove |
| --- | --- | --- | --- |
| Sections 2 to 4: setup, data pipeline, detection, fingerprint engine | Everything already built | Add rain to the weather adapter. Add `isHotspot` to stations and `peakPm10` to incidents | The OpenRouteService key |
| Section 5: API | Read endpoints, recurrence check, scoreboard | Dispatch becomes work orders with start and done. New effect measurement module | `POST /incidents/:id/dispatch` |
| Section 6: agent | Model switch, runner, limits | Two new tools, a brief mode, updated prompt | The `clean_route` tool |
| Section 7: deploy | Tables, bucket, topic, four functions | Add a fifth function and a Step Functions state machine. Bucket needs CORS | Nothing |
| Section 8: data | Backfill and replay scripts | Add the placebo test | Nothing |
| Board and ledger |  | Built by the teammate in `api/src/modules/board/`. You mount her router and import two functions |  |

If something under Keep is already built, do not rebuild it.

## 1. Scope and rules

Track A owns `api/` (except the board module), `infra/`, `scripts/` and applies agreed changes to `shared/`. It never edits `web/`.

### What Track A delivers

| Deliverable | Needed by, in hours from the pivot |
| --- | --- |
| Updated shared types, config, playbooks and fixtures | 0.5 |
| Work order endpoints and effect measurement, running locally | 3 |
| Real-data snapshot on `main`, teammate's router mounted | Checkpoint 1, hour 4 |
| Agent with ask and brief modes | 6 |
| Full stack on AWS, including the Step Functions workflow | Checkpoint 2, hour 7.5 |
| Replay dataset and placebo result | Checkpoint 2, hour 7.5 |
| Photo check, emailed brief, evidence packs, README | 9.5 |

### Boundaries

- Do not edit `web/`, `api/src/modules/board/` or `api/src/routes/board.ts`. Those belong to Track B.
- You import two things from her module: `recommend`, to pick a work order's default action, and `buildLedger`, for the agent's ledger tool. Until they exist, default to the playbook's first action.
- The types in master PRD section 9 and the endpoints in section 10 are the contract. Change them only in the joint session at the pivot, or after telling the teammate.
- Work on the `track-a` branch. Merge to `main` at hours 4 and 7.5.

### Working with Claude Code

- Start each session by having it read the new `docs/master-prd.md` and this file.
- Tell it first what already exists, so it extends your code instead of rewriting it.
- Give it one numbered task at a time. Each task has an acceptance check; do not move on until it passes.
- **Real responses before adapters.** For every external API, save a real response to `shared/fixtures/raw/` first.
- **Current docs before Strands code.** Have it read the Strands TypeScript quickstart before writing agent code.
- Commit after every task that passes.

## 2. Phase 0: setup and data test (hour 0 to 1)

By the end of hour 1, the teammate has shared types and fixtures, a Lambda is live on AWS, and the data test is answered.

| Task | What to do | Acceptance check |
| --- | --- | --- |
| A0.1 Tools | Install Node 22, AWS CLI v2 and SAM CLI | `node -v`, `aws --version` and `sam --version` all print versions |
| A0.2 AWS access | In the AWS console create an IAM user with AdministratorAccess and an access key. Run `aws configure` with region `ap-south-1` | `aws sts get-caller-identity` prints the account id |
| A0.3 API keys | Sign up for OpenAQ, data.gov.in, NASA FIRMS and a Gemini key | All four keys are in `api/.env` |
| A0.4 Repo | Create the repo with npm workspaces `shared`, `api`, `web`. Add TypeScript, `tsx` and `vitest` to `api`. Add `.gitignore` covering `.env*`, `node_modules`, `.aws-sam`, `dist` | `npm install` succeeds at the root; first commit pushed to GitHub |
| A0.5 Shared package | Write `types.ts`, `config.ts`, `aqi.ts`, `playbooks.ts` and the fixtures listed in master PRD section 10 | `npx tsc --noEmit` passes in `shared`. Teammate confirms she can import the types |
| A0.6 Hello Lambda | Minimal `infra/template.yaml` with one function behind an HTTP API returning `{ ok: true }` | `curl` on the deployed URL returns `{"ok":true}` |
| A0.7 Data test | Write and run `scripts/spike-test.ts` covering the six checks in master PRD section 8. Save one raw response per source to `shared/fixtures/raw/` | A short `docs/data-test.md` records each answer and the chosen readings source |
| A0.8 Stations | From the data test, write the 12 to 15 best stations to `shared/src/stations.json` | Every station has an id, area name, coordinates and source id |

A0.5 comes before A0.6 and A0.7 because the teammate is blocked without it.

### Commands

```bash
# one-time AWS setup
aws configure                      # access key, secret, region ap-south-1, output json
aws sts get-caller-identity

# first deploy of the hello stack
cd infra
sam build
sam deploy --guided                # stack name: wajah, region: ap-south-1, accept IAM role creation

# later deploys
sam build && sam deploy

# run a script locally
npx tsx scripts/spike-test.ts
```

The IAM user with full admin rights is a shortcut for a weekend hackathon. Delete the access key after judging.

## 3. Phase 1: data pipeline (hours 1 to 3)

By hour 3, one command pulls real readings, wind and fires for every station and stores them.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A1.1 Store | `api/src/store/`: the `Store` interface from master PRD section 9 and a `MemoryStore`. It seeds from `shared/fixtures/` and, when `STORE_FILE` is set, persists to that JSON file so real data survives restarts | Vitest: put then get readings, incidents, weather and fires round-trips correctly |
| A1.2 Readings source | `ReadingSource` interface with `fetchLatest(stations)` and `fetchHistory(station, from, to)`. Implement the adapter chosen in the data test first | `npx tsx scripts/try-source.ts rohini` prints the last 6 hourly rows with PM2.5, PM10, NO2 and CO |
| A1.3 Second readings source | Implement the other adapter only if the data test said both are needed | Same check, with `READINGS_SOURCE` switched |
| A1.4 Weather | Open-Meteo adapter returning `Weather[]` for Delhi centre | Prints 48 or more hourly rows with speed in m/s and direction in degrees |
| A1.5 Fires | FIRMS adapter: fetch the CSV, parse it, return `Fire[]` | Prints the detection count for the last 2 days and three sample rows |
| A1.6 Ingest job | `runIngest(dataset)` in `api/src/modules/ingest.ts`: fetch latest readings, weather and fires, write all three to the store, then call detection (section 4). Safe to run twice | Running it twice leaves the same row counts. Logs one line per station |

### Adapter notes

**OpenAQ.** Base URL `https://api.openaq.org/v3`, key in the `X-API-Key` header. A location has several sensors, one per pollutant, and measurements are fetched per sensor. Confirm the exact paths for "latest by location" and "hourly by sensor" in the API reference before coding. Stay under 60 requests a minute: run requests one at a time with a short delay, and back off on HTTP 429.

**CPCB feed.** One request returns every station:

```text
https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=KEY&format=json&limit=1000&filters[city]=Delhi
```

Group rows by `station`, map `pollutant_id` to the `Reading` fields using `pollutant_avg`, and treat `NA` as null. Parse `last_update` as India time and convert to UTC. This source has no history method.

**Open-Meteo.**

```text
https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.21&hourly=wind_speed_10m,wind_direction_10m,boundary_layer_height,precipitation&wind_speed_unit=ms&timezone=UTC&past_days=2&forecast_days=1
```

If `boundary_layer_height` is rejected or empty, drop it from the request and store `blh: null`.

**NASA FIRMS.**

```text
https://firms.modaps.eosdis.nasa.gov/api/area/csv/MAP_KEY/VIIRS_SNPP_NRT/73,28,78,33/2
```

The CSV has `latitude`, `longitude`, `acq_date`, `acq_time`, `confidence` and `frp` columns. `acq_time` is UTC as HHMM and may lack leading zeros, so pad it to 4 digits.

### Rules for all adapters

- Normalise every timestamp to the start of the hour in UTC.
- Keep units as the source reports them, and record the source on each reading. The engine uses ratios against each station's own baseline, so consistency per station matters more than the unit.
- Time out every external call at 10 seconds and log failures. One failing station must not stop the ingest.

## 4. Phase 1: spike detection and fingerprint engine (hours 3 to 5)

By hour 5, the local API returns a real incident with a likely cause, a confidence level and evidence chips. The rules and thresholds are in master PRD section 4; this section says how to build and test them.

Everything here is pure functions with no network or store access, so it can be unit-tested with synthetic data.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A2.1 Detect | `detect.ts`: `detectIncidents(readings, cfg)` returns windows with start, end, peak, peak time and baseline for one station | Vitest: a flat series gives none; a 3-hour spike gives one; two spikes 1 hour apart merge; a 1-hour blip gives none |
| A2.2 Features | `features.ts`: `computeFeatures(input)` returns the `Features` object | Vitest covers each feature with a hand-computed expected value |
| A2.3 Score | `score.ts`: `scoreCauses(features, cfg)` returns scores, top cause, confidence and evidence chips | The six scenario tests below pass |
| A2.4 Diagnose | `diagnose.ts`: for a station and window, read from the store, compute features, score, and build an `Incident` | Returns a complete `Incident` that passes the shared type check |
| A2.5 Wire to ingest | After each ingest, detect over the last 72 hours for every station and upsert incidents | Running ingest on real data creates incidents, or logs "0 incidents" with the max PM2.5 seen per station |

### Implementation notes

- **Upsert without losing state.** The incident id is deterministic. When an incident already exists, update its window, peak, features, scores and evidence, but keep `status`, `actions`, `checks`, `recurrenceCount` and `escalationLevel`.
- **Spatial share.** Compute spike hours for all stations first. For an incident, the share is stations with a spike hour inside the window divided by stations that have data in the window.
- **Upwind fires.** Use the haversine distance and initial bearing from the station to each fire. A fire counts when the distance is 50 to 450 km and the bearing is within 35° of the wind-from direction. Compare angles on a circle, so 350° and 10° are 20° apart.
- **Wind direction.** Average it as a circular mean, never an arithmetic mean.
- **Hour band.** Use the peak hour in Asia/Kolkata time.
- **Missing inputs.** If a rule's input is null, the rule does not fire and adds no chip. Do not treat null as zero.
- **Chip labels.** Write them as plain English sentences with the value, such as "CO up 1.6× its usual level" or "Only 2 of 14 areas spiked". Labels are English only in P0.
- **Config.** No threshold appears as a literal in engine code. Everything reads from `shared/src/config.ts`.

### Scenario tests

| Scenario | Synthetic input | Expected |
| --- | --- | --- |
| Night bonfire | One station spikes 22:00 to 01:00, pmRatio 0.7, CO 1.6×, no fires, other stations flat | `local_burning`, medium or high |
| Farm smoke | 12 of 14 stations spike, 200 upwind fires, wind from 300°, pmRatio 0.65 | `regional_smoke`, high |
| Dust | Daytime, pmRatio 0.3, wind 5 m/s, CO flat, 2 stations | `dust`, medium or high |
| Rush hour | 08:00 to 10:00, NO2 1.8×, CO 1.3×, 3 stations | `traffic`, high |
| Still night | 11 of 14 stations spike, wind 0.8 m/s, boundary layer 200 m, 5 fires | `trapped_air`, high |
| Ambiguous | Night, calm, half the stations, CO 1.3× | Low confidence, two close candidates |

### Tuning step

After the backfill in section 8, print the count of incidents by cause and confidence. If there are no incidents, or one cause takes more than 70% of them, adjust thresholds in `config.ts` and re-run. Record what was changed in `docs/data-test.md`.

## 5. Work orders, effect measurement and API (pivot hours 0.5 to 4)

By pivot hour 4, a work order can be issued, started, finished and measured through the local API, and the verdict follows the rules in master PRD section 4.7. Request and response shapes are in master PRD section 10.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A3.1 Re-align | With the teammate: update `shared/src/types.ts`, `config.ts`, `playbooks.ts` and the fixtures. Apply the renames. Add `precip` to the weather adapter, `isHotspot` to stations, `peakPm10` to incidents | `npx tsc --noEmit` passes in all three packages. Existing tests still pass |
| A3.2 Read endpoints | If not finished: `GET /stations`, `/stations/:id/readings`, `/incidents`, `/incidents/:id`, `/fires`, `/scoreboard` | Each returns real data locally and matches its fixture's shape |
| A3.3 Work orders module | `api/src/modules/workorders/`: `issue`, `start`, `finish`, each a function that takes an incident and returns the updated incident | Vitest: valid transitions succeed; invalid ones throw `invalid_state`; a disallowed action throws `action_not_allowed` |
| A3.4 Work order endpoints | `POST /incidents/:id/work-orders`, `GET /work-orders/:id`, `POST /work-orders/:id/start`, `/done`, `/measure` | With `curl`: issue, start, done, measure. The incident then shows the work order with an `effect` |
| A3.5 Effect module | `api/src/modules/effect/measure.ts`: a pure `measureEffect(input)` returning `EffectResult` | The eight tests below pass |
| A3.6 Ingest fallback | At the end of each ingest, measure every done work order that has no effect yet and whose after window is complete | Run ingest after finishing a work order in old data: the effect appears without calling `/measure` |
| A3.7 Verdict consequences | `no_effect` sets the incident to `recurred`. `worked` leaves it `dispatched`. The recurrence check clears it only if no work order has a `no_effect` verdict | Vitest covers both paths |
| A3.8 Hand-off | Mount the teammate's board router in `app.ts`. Export the local store to `shared/fixtures/snapshot.json` and commit it | `GET /board` and `/ledger` answer locally; she can run the API with no keys |
| A3.9 Contract check | Update `scripts/contract-check.ts` for the version 2 endpoints | Passes against the local server |

### Work order rules

- **Default action.** If the request has no `actionType`, call the teammate's `recommend`. If her module is not merged yet, use the playbook's first action.
- **Allowed actions.** Regional smoke and trapped air accept only `public_advisory`. Anything else returns 400 with code `action_not_allowed`.
- **Public advisory.** Created with status `done` at once. Never measured. No workflow is started.
- **Id.** `{incidentId}-w{n}`, where n is the order's position on the incident. To load a work order, strip the suffix and load the incident.
- **Instructions.** Fill the playbook template with area, local time, pollutant peak, "about N times the usual level" and the action. Polishing by the model is optional, behind `WORKORDER_POLISH=true`, with a 10-second timeout that falls back to the template.
- **Reason.** Copy the reason sentence from `recommend` onto the work order.
- **Escalation.** A new work order on a `recurred` incident gets `escalationLevel` one higher than the last.
- **Side effects of issuing.** Save the incident with status `dispatched`. If `STATE_MACHINE_ARN` is set, start an execution and store its ARN on the work order. If it is not set, do nothing more.
- **Timestamps.** `start` sets `startedAt`. `done` sets `doneAt`, and sets `startedAt` to the same time if it was never marked started.

### Effect measurement notes

- **Inputs.** The function receives everything it needs: the work order, the incident, hourly readings for the target station and all other stations around the window, weather for the window, and the list of unacted incidents with their readings. It reads nothing itself.
- **Expected change.** For each unacted incident in the pool, find how many hours after its start the action would have fallen, using the same offset as this work order from its own incident's start. Compute the same before and after means around that point. Take the median of those changes. Skip incidents without enough readings.
- **Unacted** means an incident with no work orders other than public advisories.
- **Pool.** This station's unacted incidents if there are 3 or more; otherwise all hotspot stations if there are 5 or more; otherwise 0 with the note "no baseline yet".
- **Rounding.** Store percentages to one decimal place.
- **No thresholds in code.** The 15% verdict line, the 25% city-shift limit, the rain limit and the window lengths all live in `shared/src/config.ts`.

| Test | Input | Expected |
| --- | --- | --- |
| 1. Clear drop | Before 400, 400. After 280, 280, 280. Expected change −10 | Change −30, net −20, `worked` |
| 2. Usual fade | Before 400, 400. After 352, 352, 352. Expected change −10 | Change −12, net −2, `no_effect` |
| 3. Rain | 1 mm of rain in the after window | `inconclusive`, with a note naming rain |
| 4. City-wide shift | Other stations fall 30% in the same hours | `inconclusive` |
| 5. Missing data | Only one reading in the after window | `inconclusive` |
| 6. No baseline | No unacted incidents anywhere | Expected change 0, note "no baseline yet" |
| 7. Dust | Top cause is dust | Uses PM10 for every mean |
| 8. Never started | No `startedAt` | Uses `issuedAt` as the reference time |

### Endpoint details

- **Dataset middleware.** As in version 1: "now" comes from the middleware, never from the system clock directly.
- **`GET /work-orders/:id`** returns the work order and its incident, so the field view needs one call.
- **`POST /work-orders/:id/measure`** re-measures even if an effect exists. If the after window is not complete yet, it returns the work order unchanged with HTTP 200 and no effect.
- **Errors.** Unknown ids return 404 with code `not_found`. Unexpected errors return 500 with code `internal` and are logged with the request path.

## 6. Ask Wajah agent (pivot hours 4 to 6)

By pivot hour 6, `POST /ask` answers a question in English or Hindi and, in brief mode, writes the control room's brief for the next hour. Tools, rules and the response shape are in master PRD section 5.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A4.1 Model | If not done: read the Strands TypeScript quickstart, install the SDK, and make `agent/model.ts` return a model from `MODEL_PROVIDER` and `MODEL_ID` | A 5-line script gets a one-sentence reply from the model |
| A4.2 Tools | `agent/tools.ts`: the nine tools, each a thin wrapper over an existing module. `get_board` and `get_ledger` call the teammate's `buildBoard` and `buildLedger` | Each tool runs standalone from a script and returns JSON under about 1.5 KB |
| A4.3 Prompt | `agent/prompt.ts` with the system prompt below and a separate instruction block for each mode | Reviewed against the rules in master PRD section 5 |
| A4.4 Runner | `agent/run.ts`: `ask(req)` builds the agent, picks the mode, passes up to 6 turns of history, captures the last `diagnose` or `list_incidents` result, and assembles `AskResponse` | The five tests below pass |
| A4.5 Handlers | `api/src/lambda/agent.ts` for the Function URL. Also mount `POST /ask` in `local.ts` | `curl -X POST localhost:4000/ask` works for both modes |

### System prompt

```text
You are Wajah, the duty officer's assistant in Delhi's pollution control
room. You explain why pollution spiked at a hotspot, recommend the action
that matches the cause, and report what has worked before.

Rules:
1. Use tools for every fact and number. Never state a reading, cause,
   count or result that a tool did not return.
2. Say "likely" and give the confidence level. Never say a cause is proven.
3. When you cite results, give counts: "worked 3 of 4 times". Never turn
   a count into a general claim that an action works.
4. For farm smoke or trapped air, say that no local action will help and
   that sprinklers should not be deployed for it.
5. You recommend. You never say an order has been issued.
6. Reply in the language of the user's last message, or the requested
   language in brief mode: English, Hindi in Devanagari, or Hinglish.
7. Write times in India time, like "1pm to 4pm".
8. If the question is not about air quality in Delhi, say in one sentence
   that you can only help with that.
9. If a tool returns no data, say what is missing. Do not guess.

The current time is {now}. The dataset is {dataset}.
```

**Ask mode block.** "Answer in under 120 words, as plain sentences with no headings or lists. To explain a spike, call find\_station, then list\_incidents. End with one suggested next step."

**Brief mode block.** "Call get\_board, then get\_ledger. Write the brief for the next hour in under 150 words: up to 3 actions in priority order, each naming the hotspot, the likely cause, the action, the agency and what the ledger says. Then one sentence on what not to do. If nothing needs action, say so in one sentence."

### Runner details

- **Evidence comes from code.** Wrap `diagnose` and `list_incidents` so their latest result is stored in a per-request variable. Build `evidence` and `incidentId` from that.
- **Suggested actions come from code.** If an incident was found, add `open_incident`. If it is `open` or `recurred`, add `issue_work_order`. In brief mode, add `open_board`.
- **Limits.** Cap at 6 tool calls and 45 seconds total. On any error or timeout, return a short apology in the user's language with `evidence: []` and HTTP 200.
- **Keep tool output small.** `get_board` returns at most 5 items with area, peak, cause, confidence, recommended action, agency and history. `get_ledger` returns at most 10 rows.
- **Logging.** Log each tool call with its name and duration.

### Tests

| Request | Pass condition |
| --- | --- |
| "Why was Anand Vihar so bad this afternoon?" | Names the same cause, confidence and peak as `GET /incidents` for that station |
| "कल रात जहाँगीरपुरी में हवा इतनी खराब क्यों थी?" | Same kind of facts, answered in Hindi |
| "What works at Mundka?" | Calls `get_ledger` and answers with counts |
| Brief mode, English | Lists actions in the same order as `GET /board`, with ledger counts, and a "do not" line |
| "Who will win the cricket match?" | One-sentence decline, no tool calls |

Run each with `npx tsx scripts/ask.ts`. Send the teammate the questions that work, for her suggested-question cards.

## 7. AWS deploy with SAM and Step Functions (pivot hours 5.5 to 7.5)

By pivot hour 7.5, the whole backend runs on AWS from `infra/template.yaml`, every work order starts a Step Functions execution, and the teammate has two URLs to put in Amplify.

Deploy in two steps. First everything except the workflow, so the product is live. Then the state machine. If the second step fails for 90 minutes, stop: the ingest fallback already measures effects.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A5.1 DynamoStore | If not done: `api/src/store/dynamo.ts` with the AWS SDK v3 document client | The store tests pass against real tables with `STORE=dynamo` |
| A5.2 Handlers | `lambda/api.ts`, `lambda/agent.ts`, `lambda/ingest.ts`, `lambda/verify.ts`, and the new `lambda/workflow.ts` | Each exports `handler` and type-checks |
| A5.3 Template, step one | The resources below except `WorkOrderFlow` and `WorkflowFunction` | `sam validate` passes; deploy succeeds; the stack checks pass |
| A5.4 Hand over | Send `ApiUrl` and `AgentUrl` to the teammate. Set `WebOrigin` and `WebUrl` to her Amplify URL and redeploy | Her deployed app loads the board with no CORS error |
| A5.5 Workflow function | `lambda/workflow.ts`: one handler that switches on `event.task`: `notify`, `checkDone`, `escalateOverdue`, `measure`, `escalateNoEffect` | Each task runs from a local script with a sample event |
| A5.6 State machine | `infra/workorder.asl.json` as below, and the `WorkOrderFlow` resource | A test execution started from the console with fast timings reaches `Finished` in under a minute |
| A5.7 Wire it | `ApiFunction` gets `STATE_MACHINE_ARN` and permission to start executions. Issuing a work order starts one | Issue a work order on the deployed app: an execution appears in the Step Functions console and ends with an effect on the work order |

### Resources

| Logical name | Type | Key settings |
| --- | --- | --- |
| `ReadingsTable` | DynamoDB table | Keys `pk` and `ts`, on-demand billing, TTL attribute `ttl` |
| `IncidentsTable` | DynamoDB table | Key `id`, on-demand billing |
| `EvidenceBucket` | S3 bucket | Private. CORS rule allowing PUT and GET from `WebOrigin` and `http://localhost:3000`, any header |
| `AlertsTopic` | SNS topic | Email subscriptions added by hand for the demo |
| `HttpApi` | Serverless HTTP API | CORS: allow `WebOrigin` and localhost, methods GET, POST, OPTIONS, header `content-type` |
| `ApiFunction` | Serverless function | Timeout 30 s, 512 MB. HTTP API event on `/{proxy+}`. Read and write on both tables and the bucket, publish and subscribe on the topic, start executions on the state machine |
| `AgentFunction` | Serverless function | Timeout 60 s, 1024 MB. Function URL, auth NONE, CORS for `WebOrigin`. Read-only on both tables |
| `IngestFunction` | Serverless function | Timeout 180 s, 512 MB. Schedule `rate(1 hour)`. Read and write on both tables and the bucket |
| `VerifyFunction` | Serverless function | Timeout 120 s. Schedule `cron(0 1 * * ? *)`, which is 06:30 India time |
| `WorkflowFunction` (v2) | Serverless function | Timeout 60 s, 512 MB. Read and write on both tables, read on the bucket, publish on the topic |
| `WorkOrderFlow` (v2) | Serverless state machine | `DefinitionUri: workorder.asl.json`, with `WorkflowFunctionArn` passed as a definition substitution. Permission to invoke `WorkflowFunction` |

### State machine definition

```json
{
  "StartAt": "NotifyAgency",
  "States": {
    "NotifyAgency": {
      "Type": "Task", "Resource": "${WorkflowFunctionArn}",
      "Parameters": { "task": "notify", "workOrderId.$": "$.workOrderId" },
      "ResultPath": null, "Next": "WaitForDone"
    },
    "WaitForDone": { "Type": "Wait", "SecondsPath": "$.pollSeconds", "Next": "CheckDone" },
    "CheckDone": {
      "Type": "Task", "Resource": "${WorkflowFunctionArn}",
      "Parameters": { "task": "checkDone", "workOrderId.$": "$.workOrderId", "slaSeconds.$": "$.slaSeconds" },
      "ResultPath": "$.check", "Next": "IsDone"
    },
    "IsDone": {
      "Type": "Choice",
      "Choices": [
        { "Variable": "$.check.state", "StringEquals": "done", "Next": "WaitForReadings" },
        { "Variable": "$.check.state", "StringEquals": "cancelled", "Next": "Finished" },
        { "Variable": "$.check.state", "StringEquals": "overdue", "Next": "EscalateOverdue" }
      ],
      "Default": "WaitForDone"
    },
    "EscalateOverdue": {
      "Type": "Task", "Resource": "${WorkflowFunctionArn}",
      "Parameters": { "task": "escalateOverdue", "workOrderId.$": "$.workOrderId" },
      "ResultPath": null, "Next": "WaitForDone"
    },
    "WaitForReadings": { "Type": "Wait", "SecondsPath": "$.readingsSeconds", "Next": "MeasureEffect" },
    "MeasureEffect": {
      "Type": "Task", "Resource": "${WorkflowFunctionArn}",
      "Parameters": { "task": "measure", "workOrderId.$": "$.workOrderId" },
      "ResultPath": "$.effect", "Next": "Verdict"
    },
    "Verdict": {
      "Type": "Choice",
      "Choices": [ { "Variable": "$.effect.verdict", "StringEquals": "no_effect", "Next": "EscalateNoEffect" } ],
      "Default": "Finished"
    },
    "EscalateNoEffect": {
      "Type": "Task", "Resource": "${WorkflowFunctionArn}",
      "Parameters": { "task": "escalateNoEffect", "workOrderId.$": "$.workOrderId" },
      "ResultPath": null, "End": true
    },
    "Finished": { "Type": "Succeed" }
  }
}
```

Have Claude Code check this against the current Amazon States Language reference before deploying. It is a starting point, not tested code.

### Workflow notes

- **Execution input.** `{ workOrderId, pollSeconds, slaSeconds, readingsSeconds }`. Live data: 300, 7200 and 12600. Replay data, and any demo: 5, 7200 and 5, so an execution finishes inside the video.
- **`checkDone`** returns `{ state }` as `done`, `cancelled`, `overdue` or `waiting`. It returns `overdue` only once per work order, then sets `overdueNotified` so later checks return `waiting`.
- **`notify`** publishes to the topic: a subject with the action and area, the English instructions, and the field link `{WEB_URL}/work-order/{id}?dataset={dataset}`.
- **`measure`** calls the same `measureEffect` as the API and the ingest fallback, saves the result, and returns `{ verdict }`. If the after window is not complete, it returns `inconclusive` with a note; the ingest fallback will measure it properly later.
- **`escalateNoEffect`** sets the incident to `recurred` and publishes a short message naming the alternative action.
- **Idempotent tasks.** Every task can safely run twice.

### Template notes

- **Globals.** Runtime `nodejs22.x` and the shared environment variables. Do not put `STATE_MACHINE_ARN` in Globals: the workflow function would then depend on the state machine, which depends on the workflow function, and the deploy fails on a circular dependency. Set it on `ApiFunction` only.
- **Parameters.** One per API key with `NoEcho: true`, plus `ModelProvider`, `ModelId`, `WebOrigin` and `WebUrl`.
- **Build.** SAM's esbuild build method, one entry point per function, `CodeUri: ../api`.
- **Outputs.** `ApiUrl`, `AgentUrl` and `StateMachineArn`.
- **Permissions.** SAM policy templates: `DynamoDBCrudPolicy`, `DynamoDBReadPolicy`, `S3CrudPolicy`, `SNSPublishMessagePolicy`, `StepFunctionsExecutionPolicy`, `LambdaInvokePolicy`.
- **Secrets.** Add `samconfig.toml` to `.gitignore`, because guided deploys save the keys into it.

### Things that commonly break

- **Duplicate CORS headers.** On AWS, API Gateway and the Function URL add the headers, so enable Hono's CORS middleware only in `local.ts`.
- **Bundling the agent.** If SAM's esbuild step fails on the Strands SDK, bundle the functions yourself into `api/dist/`, point `CodeUri` there, and run `sam deploy` without `sam build`.
- **Wait state input.** `SecondsPath` needs a number in the input, not a string.
- **Task result shape.** With the function ARN as the resource, the task result is the function's return value itself. The definition above relies on that.

### Stack checks

- [ ] `curl $API_URL/health` returns `{"ok":true}`
- [ ] Invoke the ingest function once by hand, then confirm rows exist in the readings table
- [ ] `scripts/contract-check.ts` passes against `$API_URL`
- [ ] `curl -X POST $AGENT_URL/ask` returns an answer in both modes
- [ ] A work order issued on replay data produces an execution that ends in `Finished` or `EscalateNoEffect`
- [ ] The topic delivers the work order email to a subscribed address
- [ ] Both EventBridge schedules appear as enabled in the console

### Commands

```bash
cd infra
sam validate
sam build && sam deploy

# run ingest once, by hand
sam remote invoke IngestFunction --stack-name wajah

# logs
sam logs -n WorkflowFunction --stack-name wajah --tail

# after judging
sam delete --stack-name wajah
```

## 8. Backfill, replay and the placebo test (pivot hours 5.5 to 7.5)

By pivot hour 7.5, both datasets hold real history, the replay dataset has enough spikes to demo every cause, and the placebo test has a result. Start these scripts while the SAM deploy runs.

Effect measurement needs history for its expected-fade baseline, and early October air may be too mild to spike. Without this section the board and ledger are empty.

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A6.1 Backfill live | `scripts/backfill.ts --days 14 --dataset live`: hourly history per station, 14 days of weather including rain, fires in 5-day requests. Then run detection over the whole range | Each station has roughly 300 or more hourly rows. The script prints incidents found |
| A6.2 Seed replay | `scripts/seed-replay.ts --from <date> --to <date> --dataset replay`: the same pipeline over a past smog period of about 14 days | 10 or more incidents across at least 3 causes, with at least one regional smoke spike |
| A6.3 Placebo test | `scripts/placebo.ts --dataset replay`: for every unacted replay incident, build a fake work order starting 1 hour after the spike began and lasting 1 hour. Measure each with `measureEffect`, leaving that incident out of its own baseline. Write `{ tested, wronglyWorked }` to `shared/src/placebo.json` | The file exists. The result is reported as it is, whatever the number |
| A6.4 Demo work orders | On the replay dataset, add work orders marked `demo: true` to 5 or 6 incidents and measure them. These show the loop; their verdicts are whatever the real readings give | The replay board and ledger are populated. Every one of these work orders carries the Demo tag |
| A6.5 Load to AWS | Run A6.1 to A6.4 from the laptop with `STORE=dynamo` and the table names from the stack outputs | `GET /ledger?dataset=replay` on the deployed URL shows rows and a placebo block |
| A6.6 Hero incidents | Print incidents by cause, confidence and status. Pick three for the video: one dust or local burning with a work order, one regional smoke, one with a no-effect verdict if one exists | Ids sent to the teammate and written in `docs/data-test.md` |

### What the placebo result means

- A fake work order does nothing, so every `worked` verdict it receives is a false positive.
- A low share, such as under 10%, supports the method. Say the number in the video.
- A high share means the expected-fade baseline is too weak. Tighten it before trusting any verdict: raise the worked threshold in `config.ts`, or require a larger baseline pool, then re-run.
- If it stays high after tuning, say so on the Method page and in the video. An honest "our first version over-credits by this much" is stronger than a clean-looking ledger nobody can trust.

### Notes

- **Demo verdicts are not findings.** Because the demo work orders were never carried out, most should come back `no_effect`, and that is correct. Do not edit results to look better. For the "Worked" design, the teammate's mock mode has an illustrative sample.
- **Choosing the replay period.** Prefer early November of last year. If station history for that period is thin, use the worst 14 days available in the last 90 days.
- **Weather for old dates.** Open-Meteo's forecast endpoint reaches back only a limited number of days. For older dates use its historical archive endpoint, and expect boundary layer height to be missing.
- **Fires for old dates.** Near-real-time FIRMS sources cover only recent weeks. Use a standard-processing source such as `VIIRS_SNPP_SP` for last year, and check its data-availability endpoint first.
- **Rate limits.** Space history requests out to stay under the per-minute limit.
- **Re-runnable.** All scripts upsert, so running them again after tuning thresholds is safe.

## 9. Extras, hand-offs and done checklist

After Checkpoint 2 the product is submittable. Everything in this section is an improvement, in priority order.

### Extras (pivot hours 7.5 to 9.5)

| Task | What to build | Acceptance check |
| --- | --- | --- |
| A7.1 Photo upload link | `POST /work-orders/:id/photo-url`: a presigned S3 PUT URL for `photos/{workOrderId}.jpg`, content type `image/jpeg`, valid 5 minutes | `curl` with `--upload-file` to the returned URL puts the object in the bucket |
| A7.2 Photo check | When `done` arrives with a `photoKey`: read the image from S3, send it with the action type and area to a vision-capable model, and store `{ key, result, note }` on the work order | A photo of a water tanker on a road returns `pass` for water sprinkling; an unrelated photo returns `fail` or `unclear` |
| A7.3 Emailed brief | When ingest creates a new incident, put an event on EventBridge with source `wajah` and detail type `IncidentDetected`. A rule sends it to the agent function, which writes the brief and publishes it to the topic | A subscribed address receives a brief after an ingest that finds a new spike |
| A7.4 Evidence to S3 | When an incident is first created, write its snapshot to `evidence/{incidentId}.json` and set `evidenceKey`. Never overwrite | The object exists in the bucket for a new incident |
| A7.5 README | What Wajah is, the architecture diagram, the AWS tools and services with one line each on why, how to run locally, how to deploy, data sources with credits, known limits | A stranger could run the API locally from the README alone |
| A7.6 Metrics (P2) | Log custom metrics in CloudWatch embedded metric format: incidents detected, work orders issued, minutes to start, actions worked, actions with no effect. A small dashboard if time allows | The metrics appear under a `Wajah` namespace |

### Photo check notes

- **Prompt.** "A field team was asked to do this: {action} at {area}. Does this photo show that kind of work? Reply with JSON only: { "result": "pass" or "fail" or "unclear", "note": one short sentence saying what the photo shows }."
- **Never block.** If the model call fails, times out after 15 seconds, or returns unparseable text, store `unclear` with the note "Photo could not be checked" and still mark the work order done.
- **Model.** Use the same provider as the agent if it accepts images. Check the Strands documentation for image input; if it is awkward, call the provider's SDK directly for this one request.
- **Limit to state.** The check confirms the kind of work shown. It does not verify place or time.

### Polish (pivot hours 9.5 to 10.5)

- Tune thresholds on the replay data, re-run the seed and placebo scripts, and reload to AWS.
- Run `contract-check.ts` against the deployed URL after the final deploy.
- Read the CloudWatch logs for the last 3 hourly ingest runs and fix any repeated error.
- Check the Billing console to confirm spend is inside the free credits.

### Video and submission (pivot hours 10.5 to 12)

- Prepare the 25-second AWS segment: issue a work order on replay data, open its execution graph in the Step Functions console as it runs through the states, then show the architecture diagram.
- Do the final `sam deploy`, then open the public URL in a private window and walk through Flow A.
- Make the repository public if the rules require it, after confirming no keys were ever committed.

### Hand-offs to Track B

| When, in pivot hours | What you give her | How |
| --- | --- | --- |
| 0.5 | Updated shared types, config, playbooks and fixtures | Joint session, merged to `main` |
| 3 | Work order endpoints working locally | Message, so she knows the shapes are final |
| 4 | A real-data snapshot, and her board router mounted | `shared/fixtures/snapshot.json` committed; `GET /board` answers locally |
| 6 | The agent questions that work, and brief mode | Message, plus updated `ask.json` fixture |
| 7.5 | `ApiUrl`, `AgentUrl` and hero incident ids | Message. She sets them in Amplify |
| 7.5 | `shared/src/placebo.json` | Committed, so her ledger can show the placebo line |
| 8.5 | Photo upload endpoint deployed | Message once a `curl` upload works |

### Done checklist

- [ ] Data test recorded in `docs/data-test.md`
- [ ] Hourly ingest runs on AWS without errors for 3 consecutive hours
- [ ] Every endpoint in master PRD section 10 answers on the deployed URL
- [ ] All Vitest suites pass: store, detect, features, score, work orders, effect, verify
- [ ] A work order issued on the deployed app runs a Step Functions execution to the end, or the fallback is documented
- [ ] Effect measurement returns all three verdicts in tests
- [ ] The placebo result is committed and reported unedited
- [ ] The agent tests pass on the deployed Function URL, in both modes
- [ ] No API key appears anywhere in the git history
- [ ] README complete, with the architecture diagram
- [ ] Stack outputs and hero incident ids shared with the teammate
