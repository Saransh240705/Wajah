# Don't show the AQI, show the next action: designing a control room for Delhi's air

*Every air-quality app tells you the air is bad. I designed one that tells a pollution officer what to do about it in the next hour, tells a field team how in Hindi, and then shows everyone whether it worked.*

---

Open any air-quality app in Delhi in November and you'll see the same thing: a big red number. **Severe. 480.** Then nothing. No reason, no next step, no owner.

That number is useful if you're deciding whether to go for a run. It's useless if you're the person in Delhi's pollution control room deciding where to send the city's limited sprinkler trucks, anti-burning patrols and traffic police **this hour**.

For our hackathon project **Wajah** ("reason" in Hindi), my teammate Saransh built the engine: sensors in, likely cause out, effect measured. I built the part people actually touch: the screens, the board logic that decides what to show first, and the deployment. This is the story of designing a pollution tool around **decisions instead of data**.

---

## Design principle 1: lead with the sentence, not the chart

Our action board doesn't open with a map or a chart. It opens with one sentence, written for a tired officer at 2pm:

> **Three spikes need a work order this hour. Start with Anand Vihar.**

Under it is a ranked list where every row answers the same four questions, left to right:

1. **Where and how bad:** *Anand Vihar · PM10 480 · Severe*
2. **Why, probably:** *Likely dust · confidence high*
3. **What to do and who does it:** *Water sprinkling · PWD*
4. **Has that worked here before:** *Worked here 3 of 4 times*

…and one button: **Issue work order**.

The ranking isn't a design flourish. It's code I wrote in the board module, and it's deliberately simple so an officer could check it by hand:

```
priority = (peak ÷ usual level) × confidence weight × (1 + 0.25 × times it came back)
```

A spike three times above normal, with a confident diagnosis, that keeps recurring, rises to the top. A spike with an unclear cause sinks, because sending a team on a guess wastes a team.

## Design principle 2: say "do nothing" loudly when that's the right answer

The most important row on our board is the one with **no button that sends a team.**

When most of Delhi spikes at once, the wind is from the north-west and satellites see hundreds of farm fires in Punjab, no sprinkler in Delhi will help. So that row reads:

> **No local action will help. Do not deploy sprinklers.** · *Issue public advisory*

We give that message its own section at the bottom of the board: "No local fix". It never competes with spikes a team can actually fix.

One bug taught me something here. Our engine stores a spike once per monitoring station, so a single farm-smoke night showed up as **36 separate rows**, burying the three local spikes an officer could actually do something about. I rewrote `buildBoard` to merge city-wide incidents whose time windows overlap into one row: **"33 areas at once, highest at Rohini."** The data was the same. The decision became obvious.

## Design principle 3: the field team gets three taps, in Hindi

The person spraying the road isn't at a desk. They're on a phone, outdoors, and very likely more comfortable in Hindi. So the work-order page is a separate, phone-first view that **opens in Hindi by default**, with English one tap away:

- **क्या करना है** (what to do): the action, the place, the responsible agency
- **क्यों** (why): one line, e.g. *संभावित कारण आसपास कुछ जलाना है* ("burning nearby is the likely cause")
- Three big buttons: **काम शुरू** (start) · **काम पूरा** (done) · **फ़ोटो जोड़ें** (add photo)

A timeline across the top shows *issued → started → done* with the time of each. Once it's done, the page says *धन्यवाद। लगभग 3 घंटे में सेंसर से परिणाम मापा जाएगा।* ("Thank you. The sensors will measure the result in about 3 hours."). That's honest about what happens next.

Translating the interface was the easy part. The hard part was the text that **comes from the server**: evidence like "CO up 1.6× its usual level", recommendation reasons, place names. A half-translated screen feels broken, so in the end every clue, reason and all 37 station names render in Hindi too: *रोहिणी, बवाना, जहाँगीरपुरी*.

## Design principle 4: never show a percentage on its own

The **ledger** is Wajah's public record of what worked: every action, at every hotspot, with how often it was tried, how often it worked, how often it had no effect, and how often the sensors couldn't tell.

We made one rule early: **counts, always.** "Worked 3 of 4 times", never "75% effective". One verdict on noisy hourly air is weak evidence, and a percentage hides how small the sample is.

The ledger also carries a line most dashboards would hide: the **placebo result**. Saransh logged fake work orders on real spikes where nothing was done, to see how often our method wrongly claims success. The answer was about **1 in 5**, and it's printed right on the ledger. Demo work orders are labelled **DEMO**, and example rows are labelled **Illustrative**. If a judge, an official or a reporter ever looks at this screen, nothing on it should overclaim.

## Design principle 5: the loop is always visible

Every incident page shows the same five-step tracker at the top:

**Detect → Diagnose → Prescribe → Act → Prove**

Each step is a section down the page: the readings chart, the likely cause with its clues, the recommended action and agency, the work order and its timeline, and finally the **verdict card**: before, after, the change you'd have expected anyway, and the net effect. You always know where an incident is in its life, and what's missing to close it.

---

## Building it fast: mock mode, then real data

We had two people and one day, so we split cleanly: shared TypeScript types as the contract, with Saransh on the backend and me on the web app (Next.js App Router + Tailwind, with a Leaflet map on OpenStreetMap tiles).

The trick that let us work in parallel was **mock mode**. With `NEXT_PUBLIC_USE_MOCKS=true`, every API call in the web app returns realistic fixtures from the shared package, with the same function signatures as the real client. I built all eight screens against fixtures that covered every cause, every status and every verdict before the real backend existed. Then I flipped one variable and the screens filled with real Delhi data.

## Shipping on AWS Amplify (and the 404 that taught me something)

The web app is deployed on **AWS Amplify Hosting**, connected to our GitHub repo, and builds on every push. My first deploy returned a clean **404** on every page. Two lessons:

- **A server-rendered Next.js app needs Amplify's "Web compute" platform.** On the static "Web" platform, Amplify serves files straight from S3, and a Next.js build output has no `index.html` to serve.
- **In a monorepo, tell Amplify where the app lives.** Our repo holds `shared/`, `api/` and `web/`. `appRoot: web` in `amplify.yml` plus the `AMPLIFY_MONOREPO_APP_ROOT=web` environment variable fixed the build.

Two smaller ones I'd pass on to any frontend dev:
- **Leaflet without its CSS looks broken, not missing.** Tiles scattered across the map and markers vanished. One import, `leaflet/dist/leaflet.css`, fixed it.
- **Label stale data as stale.** When our live data source stopped updating, the map kept saying "PM2.5 now". It now says *"Last reading 7 Oct"*, because a control-room tool that's confidently wrong is worse than one that's honestly quiet.

---

## What I'd tell anyone designing for a public problem

The hardest design work on Wajah wasn't visual. It was deciding **what not to say**: no certainty the data can't support, no percentage without its count, no button that sends a truck to fight farm smoke.

Everyone can see the AQI. The screen that matters is the one that says *why*, *who can fix it*, and *whether they did*.

---

**Built with:** Next.js · Tailwind CSS · Leaflet + OpenStreetMap · AWS Amplify Hosting · backend on AWS Lambda, API Gateway and Step Functions

*Work orders in our prototype are simulated and labelled DEMO. The readings, spikes and verdicts are real, from Delhi's government monitoring stations.*
