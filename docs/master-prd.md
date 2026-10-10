# Wajah: master PRD

Oct 10, 2026 · @Saransh

Wajah is the feedback loop for Delhi's pollution control. It detects a spike at a hotspot, finds the likely cause, recommends the matching action, tracks the work order, and measures from sensor data whether the action worked. This is the shared spec for both builders and for Claude Code.

## What changed in version 2

Version 2 was written at 16:30 on 10 October after mentor feedback. The engine stays; the user, the last two steps and the AWS workflow change.

| Area | Version 1 | Version 2 |
| --- | --- | --- |
| Main user | RWA office-bearer sending a WhatsApp notice | The city's pollution control room and its field teams |
| Loop | Diagnose, Prescribe, Dispatch, Verify | Detect, Diagnose, Prescribe, Act, Prove |
| Action | A drafted notice | A work order to an agency, marked started and done by the field team, with an optional photo check |
| Proof | Did the spike come back on later nights | Also: how much pollution fell after the action, beyond what would have happened anyway |
| New screens | None | Action board, work order field view, ledger |
| New AWS use | None | One Step Functions workflow per work order |
| Removed | None | Clean route, OpenRouteService, RWA share buttons |

**Unchanged:** ingest, source adapters, spike detection, the diagnosis engine in sections 4.1 to 4.4, the store, the agent runner, incident statuses, and the deploy approach. Code already written for these stays.

**Renames to apply once, together:** `DispatchAction` becomes `WorkOrder`. `Incident.actions` becomes `Incident.workOrders`. `POST /incidents/:id/dispatch` becomes `POST /incidents/:id/work-orders`.

## 1. What we are building

Wajah ("reason" in Hindi) is a control-room tool and AI agent that matches each pollution spike in Delhi to the right action and then measures whether that action worked.

**Problem.** Delhi has the equipment but not the feedback. In September 2026 the government put 47 pollution hotspots under 13 senior officers and approved ₹100 crore for 1,000 truck-mounted anti-smog guns. Yet there is limited evidence that anti-smog guns work, and actions run on fixed routes and schedules, not on what is causing each spike. Nobody measures which action fixed which problem.

**Evidence that matching works.** An IIT Delhi study found that targeted local fixes, such as stopping trash burning and repairing roads, cut PM2.5 by up to 26.6% in Jahangirpuri.

**Pitch line.** Delhi has the equipment. It does not know what works. Wajah closes that loop.

**What makes it different.** Other tools stop at showing the AQI or logging a complaint as "resolved". Wajah's verdict on every action comes from the sensors, not from the person who did the work.

**Hackathon fit.** Track 01 Air, covering the AQI, Pollution exposure and Stubble burning tags.

### Users

| User | What they want | What Wajah gives them |
| --- | --- | --- |
| Control-room duty officer (primary) | Know where to send limited teams and equipment this hour | A ranked board of spiking hotspots, each with a likely cause and a recommended action |
| Field team | Clear instructions and a quick way to report | A work order on their phone: start, done, one photo |
| Senior officer reviewing a hotspot | Know what is working before the weekly review | A ledger of actions and their measured effect |
| Resident or reporter | Know why the air is bad and what is being done | Plain answers in Hindi or English, and the public ledger |

### The loop

1. **Detect:** every hour, find PM spikes at monitored hotspots.
2. **Diagnose:** score the likely cause from live data: local burning, dust, traffic, farm smoke or trapped air.
3. **Prescribe:** pick the matching action and agency. For farm smoke and trapped air, say that no local action will help.
4. **Act:** issue a work order. The field team marks it started and done, and can add a photo that an AI model checks.
5. **Prove:** measure the change at the hotspot from sensor data, compare it with what normally happens when nobody acts, and record the verdict in a public ledger.

### Assumptions

These are guesses. Change them here first if they are wrong, because the timeline depends on them.

- About 12 working hours remain from the pivot at 16:30 on 10 October.
- Two builders, both using Claude Code. Saransh takes Track A, the teammate takes Track B.
- Delhi only. Hotspots are covered where a monitoring station sits nearby, starting with the 13 long-standing hotspot areas plus a few other stations for comparison.
- No login. No real government integration: work orders in the demo are simulated and labelled as such.

## 2. Scope

P0 is the submission. P1 is built only after Checkpoint 2 passes. P2 is built only if both tracks finish early.

| Priority | Feature | Owner |
| --- | --- | --- |
| P0 | Hourly ingest of station readings, wind, rain and farm fires | Saransh |
| P0 | Spike detection and cause diagnosis with evidence | Saransh |
| P0 | Work orders: issue, mark started, mark done | Saransh (API), Teammate (UI) |
| P0 | Effect measurement with a verdict per work order | Saransh |
| P0 | Recurrence check on later nights | Saransh |
| P0 | Step Functions workflow per work order, with scheduled measurement as the fallback | Saransh |
| P0 | Board ranking and ledger aggregation endpoints | Teammate |
| P0 | Ask Wajah agent on the Strands Agents SDK, including the control-room brief | Saransh (API), Teammate (UI) |
| P0 | Replay dataset from a past smog period, with a placebo test of the measurement | Saransh |
| P0 | Action board, map, area page, incident page, work order field view, ledger, Ask screen | Teammate |
| P0 | Deployed on AWS: backend with SAM, web on Amplify Hosting | Both |
| P1 | Photo check on completed work orders with a vision model | Saransh (API), Teammate (UI) |
| P1 | Brief sent by email through SNS when new spikes are detected | Saransh |
| P1 | Evidence pack per incident in S3 | Saransh |
| P1 | Method page: how diagnosis and measurement work, and their limits | Teammate |
| P2 | CloudWatch dashboard: time to start, share of actions that worked | Saransh |
| P2 | Streaming agent replies | Saransh |
| P2 | Cognito login with separate control-room and field roles | Nobody unless time remains |

### Out of scope

- Cities outside Delhi.
- Real integration with government systems or vehicle GPS. A person marks each work order started and done.
- Clean route and any routing feature. Removed in version 2.
- Training any ML model. All AI is a hosted model called through Strands.
- Forecasting future pollution.
- A native mobile app. The web app is phone-friendly, and the field view is built for phones.

## 3. The loop and user flows

Every spike becomes an incident that moves through five steps, and the app always shows which step it is on.

| Step | What the system does | What the user sees |
| --- | --- | --- |
| Detect | Finds a PM spike at a station after each hourly ingest | A new row on the action board |
| Diagnose | Computes features and scores five causes | "Likely dust, high confidence" with evidence chips |
| Prescribe | Picks the action and agency from the playbook and the ledger | "Water sprinkling, PWD. Worked here 3 of 4 times." |
| Act | Creates a work order and starts its workflow | Work order status: issued, in progress, done. Photo check result |
| Prove | Measures the change after the action and checks later nights | "Net drop 21%. Worked." or "No effect" or "Inconclusive" |

### Incident lifecycle

`open` → `dispatched` → `cleared` or `recurred`. An incident is `dispatched` once it has a work order. It becomes `recurred` if its work order shows no effect or the spike returns on a later night, and `cleared` after a work order that worked and two clean nights. A recurred incident can get a new work order, which raises its escalation level and switches to the playbook's alternative action.

### Work order lifecycle

`issued` → `in_progress` → `done`, or `cancelled`. Once done and measured, it carries a verdict: `worked`, `no_effect` or `inconclusive`.

### Flow A: duty officer handles a spike

1. Opens the action board and reads the brief: three recommended actions for this hour.
2. Opens the top row: "Anand Vihar. PM10 peaked at 480. Likely dust."
3. Reads the evidence and the recommendation: "Water sprinkling, PWD. Worked here 3 of 4 times."
4. Taps Issue work order. The agency is notified with a link.
5. Returns after a few hours and reads the verdict on the incident and in the ledger.

### Flow B: field team does the job

1. Opens the work order link on a phone.
2. Reads the instructions in Hindi or English.
3. Taps Mark started, does the work, taps Mark done, and adds one photo.

### Flow C: no local action will help

1. The board shows a city-wide spike: "Likely smoke from farm fires. 12 of 14 areas affected."
2. The recommendation reads: "No local action will help. Do not deploy sprinklers."
3. The officer issues a public advisory instead. Nothing is measured for it.

### Flow D: anyone asks why

1. Opens Ask Wajah and types a question in Hindi or English.
2. The agent calls its tools and answers in under 120 words with evidence chips.

### Ledger

A public page lists every action type at every hotspot with how often it was tried and how often it worked. It also shows the headline numbers for the demo: work orders issued, actions measured, actions that worked.

## 4. Diagnosis engine

The diagnosis is deterministic code. The model never computes or invents a number; it only explains what the engine found.

Every threshold below is a starting heuristic chosen for this hackathon, not a validated scientific constant. All of them live in `shared/src/config.ts` so they can be tuned against real data on the day.

### 4.1 Spike detection

Runs per station after each hourly ingest.

- **Baseline:** median PM2.5 at that station over the previous 7 days. If fewer than 3 days exist, use the previous 24 hours.
- **Spike hour:** PM2.5 is at least 90 µg/m³ (the start of India's "Poor" band) and at least the larger of 1.5 × baseline or baseline + 60.
- **Incident:** 2 or more consecutive spike hours. Merge windows separated by 1 hour or less. Close the incident after 2 non-spike hours.
- **Stored per incident:** station, start, end, peak PM2.5, peak hour.

### 4.2 Features

Computed over the incident window W at station S.

| Feature | Definition |
| --- | --- |
| `pmRatio` | mean PM2.5 ÷ mean PM10 in W |
| `coRise` | mean CO in W ÷ 7-day median CO at S |
| `no2Rise` | mean NO2 in W ÷ 7-day median NO2 at S |
| `spatialShare` | share of stations with data that are also in a spike hour during W |
| `windSpeed` | mean wind speed in W, m/s |
| `windDir` | circular mean of wind-from direction in W, degrees |
| `blh` | mean boundary layer height in W, metres, if the weather source returns it |
| `upwindFires` | satellite fire detections in the previous 48 hours, 50 to 450 km away, within 35° either side of the wind-from bearing |
| `hourBand` | night (21:00 to 03:00), morning rush (07:00 to 11:00), evening rush (17:00 to 21:00), or day, by local time of the peak |

### 4.3 Cause scoring

Each cause collects points for every rule that holds, capped at 100.

| Cause | Rules and points |
| --- | --- |
| `local_burning` | pmRatio ≥ 0.6 (+25); coRise ≥ 1.3 (+25); spatialShare ≤ 0.3 (+25); hourBand is night (+15); upwindFires < 10 (+10) |
| `dust` | pmRatio ≤ 0.4 (+40); coRise < 1.15 (+15); windSpeed ≥ 4 (+15); spatialShare ≤ 0.5 (+15); hourBand is day (+15) |
| `traffic` | no2Rise ≥ 1.3 (+35); hourBand is a rush band (+25); coRise ≥ 1.2 (+15); spatialShare ≤ 0.5 (+15); pmRatio between 0.4 and 0.7 (+10) |
| `regional_smoke` | upwindFires ≥ 50 (+35), and ≥ 150 adds +10; spatialShare ≥ 0.6 (+30); windDir between 250° and 360° (+15); pmRatio ≥ 0.55 (+10) |
| `trapped_air` | windSpeed ≤ 1.5 (+30); blh ≤ 300 (+20); spatialShare ≥ 0.6 (+30); upwindFires < 50 (+10); coRise and no2Rise both ≥ 1.2 (+10) |

### 4.4 Confidence and evidence

- **High:** top score ≥ 70 and at least 20 points ahead of the second cause.
- **Medium:** top score ≥ 50.
- **Low:** anything else. The UI then says "Cause unclear" and shows the two leading candidates.
- **Evidence chips:** every rule that fired becomes a chip with a label, the measured value and whether it supports or weakens the cause. Example: "CO up 1.6× its usual level".
- **Wording rule:** always "likely", never "caused by" or "proven".

### 4.5 Playbooks

Static data in `shared/src/playbooks.ts`. Each cause maps to a first action, an agency, an alternative for when the first shows no effect, and instruction templates in English and Hindi.

| Cause | First action | Agency | Alternative if no effect |
| --- | --- | --- | --- |
| Local burning | Anti-burning patrol | MCD | Anti-burning patrol escalated to DPCC |
| Dust | Water sprinkling | PWD | Mechanical sweeping by MCD, then construction inspection by DPCC |
| Traffic | Traffic management: clear the jam, divert heavy vehicles | Traffic Police | None |
| Regional smoke | Public advisory only. "No local action will help. Do not deploy sprinklers." | Residents | None |
| Trapped air | Public advisory only, plus a reminder to hold all burning | Residents | None |

The agency mapping is a simplification. In reality the responsible body depends on who owns the road or land.

### 4.6 Work order rules

- A work order has an action type, an agency, instructions in English and Hindi, and a status.
- **Recommendation.** Use the playbook's first action. If the ledger shows that action was tried at this hotspot at least twice and never worked, recommend the alternative.
- **Reason sentence.** Built in code, not by the model: the likely cause, then the ledger history. Example: "Dust is the likely cause. Sprinkling here worked 3 of 4 times."
- **Instructions.** Fill the playbook template with area, local time, pollutant peak, "about N times the usual level" and the action. The model may reword and translate, with a 10-second timeout that falls back to the filled template.
- **Issuing** a work order sets the incident to `dispatched`, notifies the agency through SNS with a link to the field view, and starts the workflow in section 7.
- **Regional smoke and trapped air** allow only the `public_advisory` action. It is marked done at once and never measured.
- **Escalation.** A new work order on a `recurred` incident raises `escalationLevel` by 1.

### 4.7 Effect measurement

This is the core of version 2. It answers one question from sensor data alone: did pollution fall more than it would have anyway?

| Quantity | Definition |
| --- | --- |
| Pollutant | PM10 when the cause is dust, PM2.5 otherwise |
| Reference time T | `startedAt`, or `issuedAt` if the order was never marked started |
| Before | Mean of the 2 hourly readings ending at or before T |
| After | Mean of the 3 hourly readings starting the hour after `doneAt`, or after T if never marked done |
| `changePct` | (after − before) ÷ before × 100 |
| `expectedChangePct` | The median `changePct` of past spikes where nobody acted, measured at the same number of hours after the spike began. Use this station's unacted incidents if there are 3 or more, otherwise all hotspot stations if there are 5 or more, otherwise 0 with the note "no baseline yet" |
| `cityChangePct` | Mean `changePct` over other stations with full data in both windows and no work order in progress |
| `netChangePct` | `changePct` − `expectedChangePct` |

**Why the expected change matters.** Spikes fade on their own. Without subtracting the usual fade, almost every action would look successful.

**Verdict**

- **Inconclusive** if either window has fewer than 2 readings, if `cityChangePct` is 25 or more in either direction, if rain above 0.2 mm fell in either window, or if mean wind speed doubled or halved between the windows.
- **Worked** if `netChangePct` is −15 or lower.
- **No effect** otherwise.

**When it runs.** The workflow measures after its wait. As a fallback, the hourly ingest measures any done work order whose after window is complete. A work order is measured once; `POST /work-orders/:id/measure` forces a re-measure.

**After the verdict.** `worked` leaves the incident `dispatched` until the recurrence check clears it. `no_effect` sets the incident to `recurred`, so the board recommends the alternative.

**Honest limits.** One result is weak evidence because air is noisy. The ledger always shows counts beside any percentage. A station can be a kilometre from the action, so small effects may not register.

### 4.8 Recurrence check

Runs daily at 06:30 IST and on demand from the incident page. Unchanged from version 1.

- **Window:** the incident's start hour minus 1 to its end hour plus 1, on each later night.
- **Recurred:** a new incident at the same station with the same top cause overlaps that window. Add 1 to `recurrenceCount` and set the status to `recurred`.
- **Cleared:** two consecutive clean nights, and no work order with a `no_effect` verdict.
- Each check is stored on the incident with its date, result and that night's peak.

## 5. Ask Wajah agent

The agent is the control room's duty officer. It is built on the Strands Agents SDK for TypeScript and has two modes: answer a question, or write the brief for the next hour.

**Where AI is used, and where it is not.** Rules and arithmetic detect spikes, score causes and measure effects, so every number can be traced. The model decides which tools to call, reasons over the ledger, writes the brief and work order instructions, and answers in Hindi or English. A vision model checks completion photos (P1).

**Before writing agent code,** read the current TypeScript quickstart at strandsagents.com. Import paths and provider names have changed between releases.

### Model

- Provider is chosen by the `MODEL_PROVIDER` environment variable: `google` by default, `bedrock` or `openai` as alternatives.
- Default to a Gemini model with a free API key so nothing depends on Bedrock model access on a new AWS account.
- Switching provider must be a one-line change in `api/src/modules/agent/model.ts`.

### Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `find_station` | free text such as "Rohini" | best-matching stations with ids |
| `get_readings` | stationId, from, to | per-pollutant summary: peak, mean, peak hour. Not the raw series |
| `list_incidents` | stationId (optional), since (optional) | incidents with status, top cause, chips and work order verdicts |
| `diagnose` | stationId, from, to | features, cause scores, confidence, evidence chips |
| `get_wind` | from, to | mean speed, direction, boundary layer height, rain |
| `get_upwind_fires` | stationId, at | count and total fire power in the upwind sector |
| `get_playbook` | cause | actions, agencies, protective advice |
| `get_board` | none | the ranked board items from section 6 |
| `get_ledger` | stationId (optional) | tried, worked and average net change by hotspot and action |

The agent recommends; it never issues a work order itself. A person taps the button.

### Rules in the system prompt

- Call a tool for every number. If a tool returns nothing, say the data is missing.
- Say "likely" and state the confidence level. Never claim proof.
- When citing the ledger, give counts: "worked 3 of 4 times", not "works".
- Reply in the user's language: English, Hindi or Hinglish.
- Ask mode: under 120 words, ending with one suggested next action.
- Brief mode: up to 3 actions for the next hour in priority order, each with hotspot, likely cause, action, agency and ledger history. Then one line on what not to do. Under 150 words.
- Decline questions unrelated to air quality in one sentence.

### Request and response

The backend, not the model, attaches evidence. It captures the result of the last `diagnose` or `list_incidents` call and adds its chips to the response.

```ts
// POST {AGENT_URL}/ask
type AskRequest = {
  mode?: 'ask' | 'brief';          // default 'ask'
  message?: string;                // required in ask mode
  history?: { role: 'user' | 'assistant'; text: string }[]; // last 6 turns at most
  stationId?: string;
  dataset?: 'live' | 'replay';
  lang?: 'en' | 'hi';              // used in brief mode
};

type AskResponse = {
  answer: string;
  evidence: EvidenceChip[];        // empty if no diagnosis ran
  incidentId?: string;
  suggestedActions: { type: 'open_incident' | 'issue_work_order' | 'open_board'; label: string; payload?: Record<string, string> }[];
};
```

### Limits

- Target under 20 seconds per answer. The Lambda timeout is 60 seconds.
- Cap the agent at 6 tool calls per request.
- On failure, return a plain apology with `evidence: []` and HTTP 200, so the UI never breaks.

## 6. Action board, ledger and photo check

The board tells the duty officer what to do this hour, and the ledger tells everyone what has worked. Both are pure calculations over incidents and work orders, built by the teammate in `api/src/modules/board/`.

### 6.1 Action board

- **Items.** Incidents with status `open` or `recurred` that started in the last 24 hours of the dataset's clock. Also dispatched incidents whose latest work order is not yet done, shown as rows in progress.
- **Priority.** (peak ÷ baseline) × confidence weight × (1 + 0.25 × `recurrenceCount`). Weights: high 1.0, medium 0.8, low 0.5.
- **Order.** Highest priority first. Incidents whose cause has no local action come after all others, however large.
- **Recommendation.** From section 4.6: the action, the agency and the reason sentence.
- **History.** The ledger row for that action at that hotspot: tried, worked, average net change.
- **Summary.** Counts of actionable spikes, spikes with no local action, and work orders in progress.

### 6.2 Ledger

- **Rows.** One per hotspot and action type over the period, 14 days by default, built from measured work orders: tried, worked, no effect, inconclusive, and average net change across the worked and no-effect results.
- **Totals.** Work orders issued, measured, worked, no effect, inconclusive.
- **Excluded.** Public advisories, because they are never measured.
- **Illustrative rows.** A row built only from work orders marked `demo: true` is flagged, and the UI labels it "Illustrative".

### 6.3 Placebo test

The measurement must not hand out false credit. To check it, a script logs fake work orders on real past spikes in the replay dataset, where nothing was actually done. A sound method marks almost none of them as worked.

The share wrongly marked worked is the method's false-positive rate. The script writes its result to shared/src/placebo.json, which the ledger reads. It is reported in the ledger response and shown on the Method page, whatever the number turns out to be.

### 6.4 Photo check (P1)

1. The field view asks the API for an upload link: a presigned S3 URL valid for 5 minutes.
2. The browser uploads the photo straight to S3.
3. Marking the work order done sends the photo's key. The API passes the image, the action type and the area to a vision model and asks for a result of pass, fail or unclear, with one sentence of explanation.
4. The result is stored on the work order and shown beside it.

A failed check is shown, never enforced. It confirms the photo shows the kind of work that was ordered. It cannot prove where or when the photo was taken.

## 7. Architecture and AWS stack

Wajah uses two AWS open-source tools and nine AWS services from the hackathon's resource table, and each one does a job the product needs.

&#91;embedded content: AWS architecture · 5 functions, 5 services, 2 entry points\]

Scheduled functions fill the store and detect spikes. Issuing a work order starts a Step Functions workflow that waits for the job, measures its effect and escalates if nothing changed.

| Part | AWS tool or service | Why the product needs it |
| --- | --- | --- |
| Agent | Strands Agents SDK (TypeScript) | The duty-officer agent: chooses tools, reads the ledger, writes the brief |
| Infrastructure as code | SAM CLI | Defines and deploys the whole backend from `infra/template.yaml` |
| Work order workflow | Step Functions | Each work order is a long-running process with waits, a deadline and an escalation path. Its execution history is the audit trail |
| Compute | Lambda | Five functions: `api`, `agent`, `ingest`, `verify`, `workflow` |
| HTTP API | API Gateway (HTTP API) | Public REST endpoints in front of the `api` function |
| Scheduling and events | EventBridge | Hourly ingest and daily recurrence check. An event for each new spike triggers the emailed brief (P1) |
| Database | DynamoDB | Readings, incidents, work orders and the ledger's source data |
| Object storage | S3 | Completion photos through presigned uploads, and an evidence pack per incident |
| Notifications | SNS | Sends each work order to its agency, plus escalations and the brief |
| Metrics and logs | CloudWatch | Logs for all functions. Custom metrics for time to start and share of actions that worked (P2 dashboard) |
| Web hosting | Amplify Hosting | Builds and serves the Next.js app from GitHub |

### Work order workflow

One Step Functions execution per work order, defined in `infra/workorder.asl.json`.

| State | Type | What it does |
| --- | --- | --- |
| `NotifyAgency` | Task | Publishes the work order to SNS with a link to the field view |
| `WaitForDone` | Wait, then Task and Choice | Checks every 5 minutes whether the field team marked it done. Cancelled orders end the workflow |
| `EscalateOverdue` | Task | If not done within 2 hours, notifies the senior officer once, then keeps waiting |
| `WaitForReadings` | Wait | Waits until 3 full hours of readings exist after the job |
| `MeasureEffect` | Task | Runs the measurement in section 4.7 and stores the result |
| `Verdict` | Choice | Worked or inconclusive: end. No effect: go to the next state |
| `EscalateNoEffect` | Task | Notifies the officer that the action did not help and marks the incident `recurred` |

Wait durations come from the execution input, so the replay dataset and the demo use seconds instead of hours.

### Request and data flow

1. EventBridge triggers `ingest` every hour. It pulls readings, weather and fires, and writes them to DynamoDB.
2. `ingest` detects spikes, diagnoses them and writes incidents. As a fallback, it also measures any finished work order the workflow has not measured.
3. The browser loads the web app from Amplify Hosting and calls API Gateway for the board, incidents, work orders and ledger.
4. Issuing a work order writes it to DynamoDB and starts a Step Functions execution.
5. The field team marks the order started and done through the API. A photo goes straight to S3.
6. The workflow measures the effect and escalates if needed.
7. Questions and the brief go to the `agent` function through a Lambda Function URL, because agent runs can exceed API Gateway's 30-second limit.
8. EventBridge triggers `verify` daily at 06:30 IST for the recurrence check.

### Decisions

- **Region:** `ap-south-1` (Mumbai) for everything.
- **One codebase, two runtimes:** the API is a Hono app. `api/src/local.ts` serves it on `localhost:4000`; `api/src/lambda/api.ts` wraps the same app for Lambda.
- **Workflow is optional locally.** With no `STATE_MACHINE_ARN` set, issuing a work order only writes it. Measurement then runs from `POST /work-orders/:id/measure` or the ingest fallback. Nobody needs AWS to develop.
- **Build order.** The ingest fallback for measurement is built first, the workflow second. If the workflow is not ready, the product still works.
- **Storage is behind an interface:** `STORE=memory` uses fixtures locally, `STORE=dynamo` uses DynamoDB when deployed.
- **Secrets:** API keys are SAM parameters marked `NoEcho`. Never commit them.
- **Model provider:** Gemini through Strands by default. Bedrock is a one-line switch.
- **Cost:** everything fits inside the AWS Free Tier credits for a weekend. Delete the stack with `sam delete` after judging.

## 8. External data sources

All four sources are free. Nobody installs sensors: the readings come from the government's own monitoring stations through public APIs.

| Source | Used for | Access | Limits and caveats |
| --- | --- | --- | --- |
| [OpenAQ v3](https://docs.openaq.org/using-the-api/quick-start) | Hourly station readings and history | Free key from explore.openaq.org, sent as the `X-API-Key` header | Reported limit of 60 requests a minute and 2,000 an hour. Measurements are fetched per sensor, not per station. Stations can be stale, so check timestamps |
| [data.gov.in CPCB feed](https://data.gov.in/resource/real-time-air-quality-index-various-locations) | Fallback for live station readings | Free key after login. Resource id `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69` | No history. Rows carry min, max and average per pollutant; whether the average is hourly or rolling is unconfirmed |
| [Open-Meteo](https://open-meteo.com) | Hourly wind speed, wind direction, boundary layer height and rain | No key | Its air quality data is a coarse model grid and cannot show differences between neighbourhoods, so never use it for diagnosis or measurement |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) | Satellite fire detections over Punjab and Haryana | Free MAP\_KEY | Area endpoint returns CSV for a bounding box, 1 to 5 days per request. Use source `VIIRS_SNPP_NRT` and box `73,28,78,33` |

Map tiles come from OpenStreetMap through Leaflet, with attribution shown on the map. OpenRouteService is no longer used.

### Stations

Start with the 13 long-standing hotspot areas, each of which has a monitoring station: Anand Vihar, Mundka, Wazirpur, Jahangirpuri, R K Puram, Rohini, Punjabi Bagh, Okhla, Bawana, Narela, Vivek Vihar, Dwarka and Ashok Vihar. Add 3 to 5 other stations for the city comparison. Confirm this list against the stations that actually return data, and mark each station `isHotspot` true or false in `stations.json`.

### Adapter rule

Each source sits behind an adapter in `api/src/modules/sources/`. Readings adapters implement one `ReadingSource` interface, so switching between OpenAQ and the CPCB feed is a config change.

**Do not guess response shapes.** Save one real response per source into `shared/fixtures/raw/` and write each adapter against that file.

### Data test

If this has not been run yet, run it before anything else. Effect measurement needs truly hourly readings.

- [ ] OpenAQ: how many Delhi stations report PM2.5, PM10, NO2 and CO, each with a reading from the last 3 hours?
- [ ] OpenAQ: does the hourly history endpoint return the last 14 days for those sensors?
- [ ] CPCB feed: does the key work, and do values change hour to hour or move like a 24-hour average?
- [ ] Open-Meteo: does the forecast endpoint return `boundary_layer_height` and `precipitation` for Delhi?
- [ ] FIRMS: how many detections does the box return for the last 2 days?

### Decision rule after the test

- OpenAQ fresh for 10 or more stations: use it for both live data and history.
- OpenAQ stale but history present: use the CPCB feed for live data and OpenAQ for backfill.
- Live readings stale or smoothed everywhere: run the whole demo on the replay dataset and say so.
- Fewer than 8 usable stations: keep the ones that work and say so on the Method page.

## 9. Data model

These types in `shared/src/types.ts` are the contract between the two tracks. Update them together in the first 30 minutes after the pivot, then freeze them again.

Lines marked `// v2` are new or changed. Everything else is as in version 1.

```ts
export type Dataset = 'live' | 'replay';
export type Cause = 'local_burning' | 'dust' | 'traffic' | 'regional_smoke' | 'trapped_air';
export type Confidence = 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'dispatched' | 'cleared' | 'recurred';
export type AqiBand = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
export type HourBand = 'night' | 'morning_rush' | 'evening_rush' | 'day';

// v2
export type ActionType =
  | 'water_sprinkling' | 'mechanical_sweeping' | 'anti_burning_patrol'
  | 'traffic_management' | 'construction_inspection' | 'public_advisory';
export type Agency = 'MCD' | 'PWD' | 'DPCC' | 'Traffic Police' | 'Residents';
export type WorkOrderStatus = 'issued' | 'in_progress' | 'done' | 'cancelled';
export type Verdict = 'worked' | 'no_effect' | 'inconclusive';

export interface Station {
  id: string;            // slug, e.g. 'anand-vihar'
  name: string;
  area: string;          // short label for the UI
  lat: number;
  lon: number;
  isHotspot: boolean;    // v2
  openaqLocationId?: number;
  cpcbName?: string;
}

export interface Reading {
  stationId: string;
  ts: string;            // ISO 8601, start of hour, UTC
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  co: number | null;
  so2: number | null;
  o3: number | null;
  source: 'openaq' | 'cpcb' | 'modelled';
}

export interface Weather {
  ts: string; windSpeed: number; windDir: number;
  blh: number | null;
  precip: number | null; // v2, mm in that hour
}
export interface Fire { lat: number; lon: number; acquiredAt: string; frp: number; confidence: string; }

export interface Features {
  pmRatio: number | null; coRise: number | null; no2Rise: number | null;
  spatialShare: number; windSpeed: number | null; windDir: number | null;
  blh: number | null; upwindFires: number; hourBand: HourBand;
}

export interface EvidenceChip {
  key: string; cause: Cause; label: string; value: string;
  effect: 'supports' | 'weakens';
}

// v2
export interface EffectResult {
  pollutant: 'pm25' | 'pm10';
  beforeMean: number;
  afterMean: number;
  changePct: number;          // at the hotspot
  expectedChangePct: number;  // usual fade when nobody acts
  cityChangePct: number;      // other stations, same hours
  netChangePct: number;       // changePct - expectedChangePct
  verdict: Verdict;
  note?: string;              // e.g. 'rain during the window', 'no baseline yet'
  measuredAt: string;
}

// v2
export interface PhotoCheck { key: string; result: 'pass' | 'fail' | 'unclear'; note: string; }

// v2, replaces DispatchAction
export interface WorkOrder {
  id: string;                 // `${incidentId}-w${n}`
  incidentId: string;
  stationId: string;
  area: string;
  actionType: ActionType;
  agency: Agency;
  status: WorkOrderStatus;
  reason: string;             // 'Dust is the likely cause. Sprinkling here worked 3 of 4 times.'
  instructionsEn: string;
  instructionsHi: string;
  escalationLevel: number;
  issuedAt: string;
  startedAt?: string;
  doneAt?: string;
  photo?: PhotoCheck;
  effect?: EffectResult;
  executionArn?: string;      // Step Functions execution, when deployed
  overdueNotified?: boolean;  // set once the overdue escalation has been sent
  demo?: boolean;             // true for simulated work orders
}

export interface VerifyCheck {
  date: string; result: 'clean' | 'recurred'; peakPm25: number | null; note?: string;
}

export interface Incident {
  id: string;                 // `${dataset}-${stationId}-${YYYYMMDDHH of start, UTC}`
  dataset: Dataset;
  stationId: string;
  area: string;
  start: string;
  end: string | null;
  peakPm25: number;
  peakPm10: number | null;    // v2
  peakAt: string;
  baselinePm25: number;
  features: Features;
  scores: Record<Cause, number>;
  topCause: Cause;
  confidence: Confidence;
  evidence: EvidenceChip[];
  status: IncidentStatus;
  recurrenceCount: number;
  escalationLevel: number;
  workOrders: WorkOrder[];    // v2, replaces actions
  checks: VerifyCheck[];
  evidenceKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationSummary extends Station {
  latest: Reading | null;
  band: AqiBand | null;
  openIncidentId: string | null;
}

// v2
export interface BoardItem {
  incident: Incident;
  priority: number;
  localActionPossible: boolean;
  recommended: { actionType: ActionType; agency: Agency; reason: string };
  history: { tried: number; worked: number; avgNetChangePct: number | null };
}
export interface Board {
  summary: { actionable: number; noLocalAction: number; inProgress: number };
  items: BoardItem[];
}

// v2
export interface LedgerRow {
  stationId: string; area: string; actionType: ActionType;
  tried: number; worked: number; noEffect: number; inconclusive: number;
  avgNetChangePct: number | null;
  illustrative: boolean;      // true when built only from demo work orders
}
export interface Ledger {
  totals: { issued: number; measured: number; worked: number; noEffect: number; inconclusive: number };
  placebo: { tested: number; wronglyWorked: number } | null;
  rows: LedgerRow[];
}

export interface Scoreboard {
  totals: { incidents: number; dispatched: number; cleared: number; recurred: number };
  areas: {
    stationId: string; area: string;
    incidents: number; recurred: number; cleared: number;
    topCause: Cause | null; lastIncidentAt: string | null;
  }[];
}
```

### AQI bands

`shared/src/aqi.ts` maps a PM2.5 value to a band using India's AQI breakpoints: up to 30 good, 60 satisfactory, 90 moderate, 120 poor, 250 very poor, above 250 severe. The official bands apply to 24-hour averages; Wajah applies them to hourly values for colour only and says so on the Method page.

### Datasets

- `live` is today's data, filled by the hourly ingest and a 14-day backfill.
- `replay` is a fixed past smog period loaded once by a script. Its "now" is the last hour of that period.
- Every endpoint accepts `?dataset=live` or `?dataset=replay` and defaults to `live`. The UI has a Live / Replay switch.

### DynamoDB tables

| Table | Partition key | Sort key | Notes |
| --- | --- | --- | --- |
| `wajah-readings` | `pk` = `{dataset}#{stationId}` | `ts` | Weather rows use `{dataset}#_weather`. TTL of 30 days on live rows |
| `wajah-incidents` | `id` | none | Work orders are stored inside their incident. Listing uses a Scan, which is fine below a few hundred items |

A work order id starts with its incident id, so a work order is found by loading that incident.

### S3 keys

- `photos/{workOrderId}.jpg`: completion photo, uploaded by the browser through a presigned URL.
- `evidence/{incidentId}.json`: readings in the window, features, scores, wind and fires used. Written once.
- `fires/{dataset}/{YYYY-MM-DD}.json`: cached fire detections per day.

### Store interface

Unchanged from version 1. Work orders are saved by calling `putIncident` with the updated incident.

```ts
export interface Store {
  putReadings(dataset: Dataset, rows: Reading[]): Promise<void>;
  getReadings(dataset: Dataset, stationId: string, fromIso: string, toIso: string): Promise<Reading[]>;
  getLatestReadings(dataset: Dataset): Promise<Reading[]>;
  putWeather(dataset: Dataset, rows: Weather[]): Promise<void>;
  getWeather(dataset: Dataset, fromIso: string, toIso: string): Promise<Weather[]>;
  putFires(dataset: Dataset, date: string, rows: Fire[]): Promise<void>;
  getFires(dataset: Dataset, fromIso: string, toIso: string): Promise<Fire[]>;
  putIncident(incident: Incident): Promise<void>;
  getIncident(id: string): Promise<Incident | null>;
  listIncidents(filter: { dataset: Dataset; stationId?: string; status?: IncidentStatus; sinceIso?: string }): Promise<Incident[]>;
}
```

`MemoryStore` loads `shared/fixtures/*.json` and is the default for local work. `DynamoStore` backs the deployed stack. A real-data snapshot at `shared/fixtures/snapshot.json` lets the API run on any laptop without API keys.

## 10. API contract

The web app talks to two base URLs: `API_URL` (API Gateway) for everything except the agent, and `AGENT_URL` (Lambda Function URL) for `/ask`.

| Method and path | Owner | Request | Response |
| --- | --- | --- | --- |
| `GET /health` | Saransh | none | `{ ok: true }` |
| `GET /stations` | Saransh | `dataset` | `StationSummary[]` |
| `GET /stations/:id/readings` | Saransh | `hours` (default 48), `dataset` | `{ station, readings, weather, incidents }` |
| `GET /incidents` | Saransh | `dataset`, `status`, `stationId`, `limit` (default 50) | `Incident[]`, newest first |
| `GET /incidents/:id` | Saransh | none | `Incident` |
| `POST /incidents/:id/work-orders` (v2) | Saransh | `{ actionType?, agency? }`, defaulting to the recommendation | `{ incident, workOrder }` |
| `GET /work-orders/:id` (v2) | Saransh | none | `{ workOrder, incident }` |
| `POST /work-orders/:id/start` (v2) | Saransh | none | `WorkOrder` |
| `POST /work-orders/:id/done` (v2) | Saransh | `{ photoKey? }` | `WorkOrder`, with the photo check when a key was sent |
| `POST /work-orders/:id/photo-url` (v2, P1) | Saransh | none | `{ uploadUrl, key }` |
| `POST /work-orders/:id/measure` (v2) | Saransh | none | `WorkOrder` with a fresh `effect` |
| `POST /incidents/:id/verify` | Saransh | none | `Incident` after a recurrence check |
| `GET /board` (v2) | Teammate | `dataset` | `Board` |
| `GET /ledger` (v2) | Teammate | `dataset`, `days` (default 14) | `Ledger` |
| `GET /scoreboard` | Saransh | `dataset`, `days` (default 14) | `Scoreboard` |
| `GET /fires` | Saransh | `dataset`, `hours` (default 48) | `Fire[]` |
| `POST /subscribe` (P1) | Saransh | `{ email }` | `{ ok: true }` |
| `POST /ask` on `AGENT_URL` | Saransh | `AskRequest` | `AskResponse` |

Removed in version 2: `POST /incidents/:id/dispatch`, `GET /geocode`, `POST /route`.

### Conventions

- All timestamps are ISO 8601 in UTC. The web app converts to India time for display.
- Errors return `{ error: { code, message } }` with a 4xx or 5xx status. `/ask` always returns 200 with a readable answer.
- CORS allows `WEB_ORIGIN` and `http://localhost:3000`.
- Playbooks are not an endpoint. The web app imports them from `shared`.
- Unknown ids return 404 with code `not_found`.
- An action type that the incident's cause does not allow returns 400 with code `action_not_allowed`.
- Starting a work order that is not `issued`, or finishing one that is `cancelled`, returns 409 with code `invalid_state`.

### Mock mode

With `NEXT_PUBLIC_USE_MOCKS=true`, `web/src/lib/api.ts` returns data from `shared/fixtures/` instead of calling the network. Every function in that file has the same signature in both modes.

### Fixtures to update after the pivot

- `stations.json`: add `isHotspot` to each station.
- `incidents.json`: 6 incidents covering all five causes and all four statuses. Replace `actions` with `workOrders` covering every work order status and all three verdicts, one with a photo check.
- `board.json`: 5 items, including one with no local action and one recommending the alternative.
- `ledger.json`: 8 rows with a mix of results, one flagged illustrative, and a placebo block.
- `ask.json`: one ask-mode answer and one brief.
- Delete `route.json`. Keep `readings-rohini.json`, `scoreboard.json` and `fires.json`.

## 11. Repo, ownership and git

One repository with npm workspaces, TypeScript everywhere, Node 22. Each person owns separate folders, so merges rarely conflict.

```text
wajah/
  package.json              # npm workspaces: shared, api, web
  docs/                     # these PRDs, exported as Markdown
  shared/
    src/types.ts            # section 9
    src/config.ts           # every threshold from section 4
    src/aqi.ts              # PM2.5 value -> band
    src/playbooks.ts        # actions, agencies, EN and HI templates
    src/stations.json
    fixtures/               # mock responses; fixtures/raw/ holds real API samples
  api/
    src/app.ts              # Hono app, mounts all routers
    src/local.ts            # serves app.ts on localhost:4000
    src/lambda/             # api.ts, agent.ts, ingest.ts, verify.ts, workflow.ts
    src/routes/             # one router file per resource
    src/modules/sources/    # openaq, cpcb, openmeteo, firms adapters
    src/modules/detect/     # spike detection
    src/modules/fingerprint/# features, scoring, evidence
    src/modules/workorders/ # issue, start, done, photo check (v2)
    src/modules/effect/     # effect measurement (v2)
    src/modules/verify/     # recurrence check
    src/modules/agent/      # Strands agent, tools, model switch
    src/modules/board/      # board ranking and ledger (v2, Teammate)
    src/store/              # Store interface, MemoryStore, DynamoStore
  web/                      # Next.js App Router, Tailwind
  infra/
    template.yaml           # SAM template
    workorder.asl.json      # Step Functions definition (v2)
    samconfig.toml
  scripts/
    spike-test.ts           # section 8 data test
    backfill.ts             # last 14 days into 'live'
    seed-replay.ts          # past smog period into 'replay'
    placebo.ts              # section 6.3 placebo test (v2)
```

Workspace package names are `@wajah/shared`, `@wajah/api` and `@wajah/web`. Export the four docs as Markdown into `docs/` as `master-prd.md`, `track-a.md`, `track-b.md` and `design-brief.md`, replacing the version 1 files.

### Ownership

| Path | Owner |
| --- | --- |
| `shared/` | Updated together after the pivot, then frozen. Saransh applies agreed changes |
| `api/` except the two board items below | Saransh |
| `api/src/modules/board/`, `api/src/routes/board.ts` | Teammate |
| `infra/`, `scripts/` | Saransh |
| `web/` | Teammate |
| `README.md`, architecture diagram | Saransh |
| Demo video script and recording | Teammate leads, both appear |

The teammate no longer builds `api/src/modules/route/`. Delete it if it exists.

### Git rules

- `main` always runs. Work on `track-a` and `track-b`.
- Do the renames from the change table in one commit on `main`, with both people present, before either track continues.
- Merge both branches into `main` at each checkpoint in section 12, not only at the end.
- Never edit a file in the other person's folder. Ask them, or leave a `TODO(track-a)` or `TODO(track-b)` comment.
- Commit at least once an hour with a message that says what works now.

### Environment variables

| Variable | Used by | Value |
| --- | --- | --- |
| `STORE` | api | `memory` locally, `dynamo` deployed |
| `OPENAQ_API_KEY` | api | from explore.openaq.org |
| `DATA_GOV_API_KEY` | api | from data.gov.in |
| `FIRMS_MAP_KEY` | api | from the FIRMS site |
| `MODEL_PROVIDER`, `MODEL_ID` | api | `google` and a current Gemini model id by default |
| `GOOGLE_API_KEY` | api | Gemini key, or the variable name the Strands provider expects |
| `STATE_MACHINE_ARN` (v2) | api | set by the SAM template; unset locally |
| `WEB_URL` (v2) | api | the Amplify URL, used in work order links |
| `READINGS_TABLE`, `INCIDENTS_TABLE`, `EVIDENCE_BUCKET`, `ALERTS_TOPIC_ARN` | api | set by the SAM template |
| `WEB_ORIGIN` | api | the Amplify URL |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AGENT_URL` | web | SAM stack outputs |
| `NEXT_PUBLIC_USE_MOCKS` | web | `true` until Checkpoint 1 |

`ORS_API_KEY` is no longer needed. Local values go in `api/.env` and `web/.env.local`, both git-ignored.

## 12. Timeline and cut rules

The plan fits 12 working hours from the pivot and reaches a submittable, deployed product at hour 7.5. Hours count from 16:30 on 10 October; shift them to match the real deadline.

| Phase | Hours from pivot | Saransh (Track A) | Teammate (Track B) | Exit check |
| --- | --- | --- | --- | --- |
| 0. Re-align, together | 0 to 0.5 | Update shared types, config, playbooks and fixtures. Apply the renames. Remove route code | Same session. Update the API client's function list | Type-check passes in all three packages. Both agree the fixtures look right |
| 1. Core loop | 0.5 to 4 | Finish ingest, detection and diagnosis if not done. Work order endpoints. Effect measurement with tests, and the ingest fallback. Export the real-data snapshot | Action board, incident page with five steps, work order card, field view, all on fixtures. Board and ledger module with tests | Locally: issue a work order, mark it started and done, measure it, and see a verdict |
| Checkpoint 1 | 4 | Merge to `main` | Merge to `main`, switch mock mode off | The loop runs in the browser against the local API on the real-data snapshot |
| 2. Agent, cloud, data | 4 to 7.5 | Agent with ask and brief modes. SAM deploy including Step Functions. Backfill, replay and placebo scripts | Ledger screen, Ask screen with the brief, Hindi pass. Point Amplify at the deployed API | Each endpoint answers on the deployed URL. A new work order shows a running Step Functions execution |
| Checkpoint 2 | 7.5 | Merge to `main` | Merge to `main` | On the public URL: board, incident, issue a work order, mark it done from a phone, read the verdict, see it in the ledger. This is a valid submission |
| 3. Extras | 7.5 to 9.5 | Photo check, emailed brief through EventBridge and SNS, evidence packs to S3, README | Photo upload in the field view, Method page | A completion photo returns pass or fail on the deployed app |
| 4. Polish | 9.5 to 10.5 | Tune thresholds on replay data, read logs, CloudWatch metrics if time allows | Empty and error states, phone pass, outside-user test | A person outside the team completes Flow A without help |
| 5. Video and submit | 10.5 to 12 | AWS segment: the Step Functions execution graph and the architecture diagram. Final deploy check | Script, screen recording, edit | 3-minute video uploaded, form submitted, URL tested in a private window |

### Cut rules

- Never cut effect measurement. It is the reason the project exists.
- If fewer than 9 hours remain at the pivot, skip Phase 3 entirely.
- If Step Functions is not deployed after 90 minutes of trying, ship with the ingest fallback doing the measuring, and name the workflow as the next step in the video.
- If the agent is unstable at hour 9, limit it to the brief and the suggested questions known to work.
- If live data has no spikes or is stale, demo on the replay dataset and label it on screen.
- Stop adding features at hour 9.5. After that, only fixes.
- Start recording the video by hour 10.5 even if something is broken. A missing video scores zero.

## 13. Demo video and judging map

The video is the only thing judges see, so all five steps must appear in it within 3 minutes.

| Time | Beat | On screen |
| --- | --- | --- |
| 0:00 to 0:20 | Hook: "Delhi is spending ₹100 crore on anti-smog guns. Nobody can say which actions work." | A news headline, then the Wajah action board |
| 0:20 to 0:45 | Detect and diagnose | Top board row, open the incident, likely cause and evidence chips |
| 0:45 to 1:05 | Prescribe | The recommendation with ledger history. Then a farm-smoke spike: "No local action will help. Do not deploy sprinklers." |
| 1:05 to 1:35 | Act | Issue the work order. Switch to a phone: Hindi instructions, Mark started, Mark done, photo check |
| 1:35 to 2:05 | Prove | The effect card: before, after, expected fade, net change, verdict. Then the ledger, and the placebo result in one line |
| 2:05 to 2:25 | The agent | Ask in Hindi why an area was bad, then the brief for the next hour |
| 2:25 to 2:50 | Built on AWS | The Step Functions execution graph for that work order, then the architecture diagram |
| 2:50 to 3:00 | Close | The limits in one line, then the pitch line |

Say on camera that the readings are real, that the work orders are simulated, and that effect numbers on simulated actions are illustrative.

### Judging criteria

| Criterion | How Wajah answers it |
| --- | --- |
| Idea and impact | A specific gap in Delhi today: large spending on pollution actions with no measurement of what works. What changes: actions match causes, wasted deployments stop, and results are public |
| Built on AWS | Two AWS open-source tools and nine AWS services, each doing a job the product needs. Step Functions runs every work order |
| Design and usability | One loop shown as five steps. A board that says what to do next. A field view with three taps. Hindi and English |
| The execution | The full loop works end to end on real readings by hour 7.5. Extras come after |
| The demo video | Scripted to the table above, recorded by hour 10.5 |

### Questions a judge will ask

| Question | Answer |
| --- | --- |
| Where is the AI? | The agent decides what to check, reasons over the ledger and writes the brief and instructions. A vision model checks photos. Numbers come from rules, so they can be traced |
| How do you know an action worked? | Sensors, not people. The change at the hotspot minus the usual fade of spikes where nobody acted |
| Spikes fade anyway. Is that not false credit? | That is why the expected fade is subtracted, and why the placebo test reports the false-positive rate |
| Are these real government actions? | No. The work orders are simulated. The method is ready and needs one season of real logged actions |
| Will agencies use it? | It needs two taps from a field team and gives officers a ranked list. It asks for no new equipment |

## 14. Risks and open questions

The largest risk is still data: effect measurement needs readings that are fresh and truly hourly.

| Risk | What happens | Mitigation |
| --- | --- | --- |
| Station data is stale or smoothed | Before-and-after comparison is meaningless | Run the data test first. Two sources behind one adapter. Replay dataset for the demo |
| No real actions to measure | Effect numbers in the demo are not real findings | Label simulated work orders and illustrative rows. Show the method and the placebo test, not invented results |
| Measurement gives false credit | Fading spikes look like successes | Subtract the expected fade. Report the placebo false-positive rate honestly |
| Pivot costs build time | Less time for the core loop | Engine and infrastructure are unchanged. Clean route is dropped, which frees about 3 hours |
| Step Functions is new to the team | Deploy trouble late in the day | Build the ingest fallback first. Wait times come from input, so tests run in seconds. A 90-minute limit before falling back |
| Diagnosis is wrong or overclaims | Loss of trust with judges | Heuristics labelled as such, "likely" wording, confidence levels, evidence shown, a Method page |
| Agent is slow or fails | Chat or brief hangs in the video | Function URL with a 60-second timeout, 6 tool-call cap, safe fallback answer |
| Strands TypeScript API differs from memory | Wasted hours on import errors | Read the current quickstart before coding |
| Photo upload fails in the browser | Field view breaks at the last step | The photo is optional. S3 bucket CORS must allow PUT from the web origin |
| Merge conflicts | Broken build near submission | Renames in one shared commit. Separate folders. Two checkpoints |

### Open questions

- How many hours actually remain? The timeline assumes 12 from the pivot.
- Has the data test been run, and which readings source won?
- Does the team have a Gemini API key, or should the agent use another provider?
- Which past period should the replay dataset cover?

## 15. Sources

Figures below were taken from search results today, not verified against the original documents or by calling the APIs. Check the news figures before quoting them in the video.

- [eGov Magazine: Delhi puts 47 pollution hotspots under watch](https://egov.eletsonline.com/?p=106701): 47 hotspots, 13 senior officers, weekly reviews, ₹100 crore for 1,000 anti-smog guns
- [CEEW: Are anti-smog guns the right choice for Delhi's dust?](https://www.ceew.in/node/4774): limited evidence of effectiveness, 2% of roads covered
- [CarbonCopy: IIT Delhi study on local interventions](https://newsletter.carboncopy.info/?p=80668): PM2.5 cut by up to 26.6% in Jahangirpuri
- [The Pioneer: Winter Action Plan 2025-26](https://www.dailypioneer.com/2025/state-editions/winter-action-plan-unveiled-to-tackle-pollution.html): sweepers, sprinklers, anti-smog guns and anti-burning teams deployed
- [Down To Earth: Delhi's green war room](https://www.downtoearth.org.in/news/pollution/delhi-to-monitor-air-pollution-24x7-with-green-war-room-ahead-of-winter-92081): complaint counts and the claimed resolution rate
- [Strands Agents quickstart overview](https://strandsagents.com/docs/user-guide/quickstart/overview/index.md): Python and TypeScript SDKs, model providers
- [Strands Agents TypeScript quickstart](https://strandsagents.com/docs/user-guide/quickstart/typescript/index.md): install, tools, model providers
- [OpenAQ API quick start](https://docs.openaq.org/using-the-api/quick-start) and [API reference](https://docs.openaq.org/api): key, locations, sensors, hourly measurements
- [OpenAQ API summary on Free API Hub](https://freeapihub.com/apis/openaq-api): reported rate limits
- [data.gov.in: Real time Air Quality Index from various locations](https://data.gov.in/resource/real-time-air-quality-index-various-locations): CPCB feed
- [NASA FIRMS area API](https://firms.modaps.eosdis.nasa.gov/api/area/): endpoint format, sources, MAP\_KEY
- Hackathon overview page screenshots: tracks, prize rule, resource table and judging criteria
