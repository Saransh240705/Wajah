# We built an AI control room for Delhi's air, then tried to fool it

*How I used Strands Agents, Step Functions and SAM to build a system that doesn't just say why Delhi's air turned toxic, but checks from the sensors whether anyone actually fixed it.*

---

On the night of 11 November 2025, the air at Rohini in north-west Delhi hit **690 µg/m³ of PM2.5** in a single hour. India's 24-hour standard is 60.

A city running on fixed schedules sends water sprinklers when that happens. But 33 of Delhi's 37 monitoring stations spiked at the same time, the wind was blowing from the north-west, and NASA satellites could see **716 farm fires** burning upwind in Punjab and Haryana. That pollution was smoke from farm fires. No sprinkler in Delhi was going to touch it.

That is the gap my teammate and I set out to close at this hackathon. Delhi doesn't lack equipment: sprinklers, anti-smog guns and anti-burning patrols are all deployed. What it lacks is **feedback**. Actions run on routines, not on causes, and a job is marked "resolved" when someone *says* it was done, not when the air gets cleaner.

So we built **Wajah** ("reason" in Hindi). It runs one loop, every hour:

> **Detect** a spike → **Diagnose** the likely cause → **Prescribe** the matching action → **Act** through a work order → **Prove** from the sensors whether it worked.

I built the backend, the AI agent and the AWS stack. Here's how, including the part where our own test showed our method was wrong more than half the time.

---

## The architecture: one SAM template, five Lambdas, one state machine per job

Everything is serverless in `ap-south-1` (Mumbai), defined in a single `template.yaml` and deployed with **AWS SAM**:

- **Amazon EventBridge** triggers an `ingest` **Lambda** every hour. It pulls readings from 37 government stations (via OpenAQ), weather from Open-Meteo and satellite fires from NASA FIRMS, then detects and diagnoses spikes.
- **Amazon DynamoDB** stores readings, incidents and their work orders.
- **Amazon API Gateway** (HTTP API) serves the web app.
- **AWS Step Functions** runs one execution **per work order**.
- **Amazon SNS** emails each agency its jobs.
- **Amazon S3** takes completion photos straight from field phones through presigned URLs.
- The **Strands Agents** duty-officer agent runs behind a **Lambda Function URL**, because AI answers can outlast API Gateway's 30-second timeout.

The diagnosis itself is deliberately *not* AI. It's deterministic code: each cause leaves a fingerprint in the data.

| Likely cause | What it looks like in the sensors |
| --- | --- |
| Local burning | CO rises with fine particles, at night, in only one or two areas |
| Dust | Coarse particles dominate (PM2.5 is a small share of PM10), windy, daytime |
| Traffic | NO₂ jumps during rush hour |
| Farm smoke | Most of the city spikes together, wind from the north-west, fires upwind |
| Trapped air | Most of the city spikes, the wind is calm, the mixing layer is low |

Every threshold lives in one config file, and every answer says **"likely"**, with a confidence level and the clues shown. Rules compute the numbers; the AI explains them.

---

## Step Functions: a work order is a long-running process, so model it as one

A work order has waits, a deadline and an escalation path. That's exactly what a state machine is for, so each work order gets its own **Step Functions** execution:

```json
"WaitForDone":   { "Type": "Wait", "SecondsPath": "$.pollSeconds", "Next": "CheckDone" },
"CheckDone":     { "Type": "Task", "Resource": "${WorkflowFunctionArn}",
                   "Parameters": { "task": "checkDone", "workOrderId.$": "$.workOrderId", ... },
                   "ResultPath": "$.check", "Next": "IsDone" },
"IsDone":        { "Type": "Choice", "Choices": [
                   { "Variable": "$.check.state", "StringEquals": "done",    "Next": "WaitForReadings" },
                   { "Variable": "$.check.state", "StringEquals": "overdue", "Next": "EscalateOverdue" } ],
                   "Default": "WaitForDone" },
"WaitForReadings": { "Type": "Wait", "SecondsPath": "$.readingsSeconds", "Next": "MeasureEffect" }
```

It notifies the agency, polls until the field team taps "done", escalates once if the job is overdue, waits for three hours of sensor data, measures the effect, and escalates if nothing changed. The execution graph doubles as an **audit trail** of what happened to every order.

Two things made this easy to live with:
- **Wait times come from the execution input**, not the definition. Live jobs wait hours; the demo passes 5 seconds, and a full execution runs end to end in about **16 seconds**.
- **Every task is idempotent**, and the hourly ingest re-measures any finished job the workflow missed. If Step Functions ever failed, the product would still prove its results. Building that fallback first meant the workflow was never a single point of failure.

One real bug to share: replay work orders carry *simulated* timestamps from 2025, so "overdue after 2 hours" fired on the very first check. The fix was to pass `issuedAtReal` in the execution input and measure deadlines on the real clock.

---

## Strands Agents: a duty officer that is only allowed to quote tools

The agent answers questions like *"कल रात जहाँगीरपुरी में हवा इतनी खराब क्यों थी?"* ("Why was the air so bad in Jahangirpuri last night?") and writes the control room's brief for the next hour. I built it with the **Strands Agents SDK for TypeScript**, and the design rule was simple: **the model never invents a number.** It has nine tools over our data, and the system prompt forbids stating anything a tool didn't return.

Tools are just Zod schemas plus a callback:

```ts
tool({
  name: 'diagnose',
  description: 'Score the five causes for a station over a time window: features, scores, likely cause, confidence and evidence.',
  inputSchema: z.object({ stationId: z.string(), from: iso, to: iso }),
  callback: async ({ stationId, from, to }) => {
    const d = await diagnoseRange(store, dataset, stationById(stationId)!, from, to);
    capture.diagnosis = { stationId, evidence: d.evidence.filter((c) => c.cause === d.topCause), topCause: d.topCause };
    return { likelyCause: causeName(d.topCause), confidence: d.confidence, clues: /* … */ };
  },
}),
```

Notice `capture`. The **evidence shown on screen comes from our code, not from the model's prose**. Strands **hooks** made the guardrails clean too:

```ts
agent.addHook(BeforeToolCallEvent, (e) => {
  calls++;
  if (calls > config.agent.maxToolCalls) e.cancel = 'Tool call limit reached. Answer now with what you already have.';
});

const result = await agent.invoke(message, {
  cancelSignal: AbortSignal.timeout(config.agent.timeoutMs),
  limits: { turns: config.agent.maxToolCalls + 2 },
});
```

A 6-call cap, a 45-second timeout, and on any failure a polite apology in the user's language with HTTP 200, so the UI never breaks.

**Lessons from the agent:**
- **Read the current SDK source, not your memory.** The TypeScript SDK had moved repos. The Gemini provider lives at `@strands-agents/sdk/models/google` and reads `GEMINI_API_KEY`, not the variable name I'd assumed.
- **Model defaults age fast.** The SDK's default Gemini model timed out on us on the day; `gemini-3.5-flash-lite` answered in a few seconds. Strands made that a one-line switch, and the same one line would point it at Amazon Bedrock.
- **Thinking models count thinking against your token cap.** Our first answer died with "max tokens reached" at 1,024. A low thinking level plus a higher cap fixed it.
- **Models copy what they see.** Tool schemas listed `regional_smoke` as an enum, and that code name showed up in the middle of a Hindi answer. A small code-side clean-up maps any code name to its Hindi or English label before the answer leaves the server.

---

## The part I'm proudest of: we tried to fool ourselves

Here's the trap in "did the action work?". **Pollution spikes fade on their own.** Send a sprinkler to any spike, wait three hours, and the air is usually better. A naive system would hand out credit for nothing.

So measuring the effect means subtracting *what would have happened anyway*. Then we ran a **placebo test**: for every past spike in our replay dataset where nobody did anything, we logged a fake work order and measured it exactly like a real one. A sound method should almost never say "worked" for a job that never happened.

Our first method, which compared each spike with the usual fade of past spikes at that station, **said "worked" for 31 of 57 fake jobs. That's 54%.** Worse than a coin flip.

We could have quietly tuned it until the number looked good. Instead we dug into *why*:

| Method | Wrongly said "worked" | On local spikes |
| --- | --- | --- |
| Compare with past fades (the original spec) | 31 of 57 (54%) | 1 of 1 |
| Compare with other stations over the same hours | 36 of 157 (23%) | **6 of 6** |
| **Hybrid: local spikes vs past local fades, city-wide spikes vs other stations** | **62 of 297 (21%)** | 0 of 7 |

The second row taught us the most. Comparing with other stations looked great overall, **but it failed every single local spike**. When one area spikes from a bonfire and the rest of the city is calm, the natural fade looks like success. Local spikes are exactly where real work orders go, so a good-looking average was hiding the worst possible failure.

The hybrid gives each kind of spike the comparison that suits it, and **refuses to judge** (rain, a city-wide shift, missing readings, a sudden wind change) rather than guess. On a second dataset with mostly local spikes, it was wrong **9 times out of 32**.

That's still not perfect, and we say so on the Method page. A real number we can defend beats a pretty one we can't. It's also why the ledger always shows counts ("worked 3 of 4 times") and never a lone verdict.

---

## Gotchas worth saving you an hour

- **SAM dropped my HTTP API's CORS block without a word.** I wrote `AllowOrigins: !If [HasWebOrigin, [...], [...]]`. `sam validate` passed and the deploy succeeded, but the API had *no* CORS. Running the SAM translator locally showed the whole block replaced by the `If`. **Plain lists in `CorsConfiguration` work.**
- **An `ANY /{proxy+}` route swallows CORS preflights.** API Gateway forwards `OPTIONS` to your Lambda instead of answering it. Return 204 for `OPTIONS` in the app, and API Gateway adds the CORS headers.
- **Public Function URLs now need two permissions** (`lambda:InvokeFunctionUrl` *and* `lambda:InvokeFunction`). SAM's `FunctionUrlConfig` generates both. I checked the transformed template rather than trusting memory.
- **Pre-bundle instead of `sam build` in a monorepo.** SAM's esbuild step runs `npm install` on a copy of the function folder, which can't resolve workspace packages. Bundling each function with esbuild into `dist/` and pointing `CodeUri` there just worked.
- **Let an automated review read your diffs.** A security review caught that our photo-check endpoint accepted any S3 key, which would let a caller make the API read arbitrary objects. Now it accepts only the work order's own upload key.

---

## What it does today

- **37 Delhi monitoring stations**, hourly, with **8 hours in a row of error-free ingest** on AWS at the time of writing.
- **405 real spikes** in a two-week replay of the November 2025 smog season, each with a likely cause, confidence and evidence.
- **Work orders end to end:** issue → field team marks started and done in Hindi or English → photo check by a vision model → Step Functions measures and escalates → the verdict lands in a public ledger.
- **An agent** that answers in Hindi or English in a few seconds and writes the hourly brief.

The honest limits: work orders in this prototype are **simulated** (the readings are real), a monitor can be a kilometre from where the work happens, and one verdict is weak evidence on its own.

---

## Why this matters

Delhi will keep fighting its air for years: vehicles, industry, farm fires, weather. No app fixes that. But every winter, real teams with real equipment go out every day, and **nobody checks which of their work actually helped**. Wajah doesn't need new hardware. It needs a phone in a field team's hand and the sensors the city already owns.

*Everyone can see the AQI. Wajah tells you why, who can fix it, and whether they did.*

---

**Built with:** Strands Agents SDK (TypeScript) · AWS SAM · AWS Step Functions · AWS Lambda · Amazon API Gateway · Amazon EventBridge · Amazon DynamoDB · Amazon S3 · Amazon SNS · Amazon CloudWatch

**Data:** OpenAQ (CPCB and DPCC stations), Open-Meteo, NASA FIRMS, © OpenStreetMap contributors
