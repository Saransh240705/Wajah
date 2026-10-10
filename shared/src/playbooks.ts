// Static playbooks, master PRD section 4.5. Imported by the API and the web app.
// The agency mapping is a simplification: in reality it depends on who owns the road or land.

import type { ActionType, Agency, Cause } from './types';

export interface ActionInfo {
  type: ActionType;
  labelEn: string;           // 'Water sprinkling'
  labelHi: string;
  shortEn: string;           // used in reason sentences: 'Sprinkling here worked 3 of 4 times.'
  measurable: boolean;       // public advisories are never measured
  // Instruction templates. Placeholders: {area} {time} {pollutant} {peak} {usual} {agency}.
  // {usual} is ', about 2.5 times the usual level' (or the Hindi form), or '' when the usual level is unknown
  templateEn: string;
  templateHi: string;
}

export interface PlaybookStep { actionType: ActionType; agency: Agency }

export interface Playbook {
  cause: Cause;
  labelEn: string;           // 'Dust'
  labelHi: string;
  likelyEn: string;          // 'Dust is the likely cause.'
  likelyHi: string;
  localActionPossible: boolean;
  // steps[0] is the first action; later steps are alternatives, used in order after no effect
  steps: PlaybookStep[];
  adviceEn: string;          // protective advice for residents
  adviceHi: string;
  doNotEn?: string;
  doNotHi?: string;
}

export const ACTIONS: Record<ActionType, ActionInfo> = {
  water_sprinkling: {
    type: 'water_sprinkling',
    labelEn: 'Water sprinkling',
    labelHi: 'पानी का छिड़काव',
    shortEn: 'Sprinkling',
    measurable: true,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. Sprinkle the main roads within about 1 km of the {area} monitoring station. Responsible: {agency}. Tap Mark started and Mark done on the field page, and add one photo.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। {area} निगरानी स्टेशन के लगभग 1 किमी के दायरे की मुख्य सड़कों पर छिड़काव करें। ज़िम्मेदारी: {agency}। फ़ील्ड पेज पर "काम शुरू" और "काम पूरा" दबाएँ, और एक फ़ोटो जोड़ें।',
  },
  mechanical_sweeping: {
    type: 'mechanical_sweeping',
    labelEn: 'Mechanical sweeping',
    labelHi: 'मशीन से सड़क की सफ़ाई',
    shortEn: 'Mechanical sweeping',
    measurable: true,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. Run mechanical road sweepers on the main roads within about 1 km of the {area} monitoring station and clear dust heaps from the kerbs. Responsible: {agency}. Tap Mark started and Mark done on the field page, and add one photo.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। {area} निगरानी स्टेशन के लगभग 1 किमी के दायरे की मुख्य सड़कों पर मशीन से सफ़ाई करें और किनारों से धूल के ढेर हटाएँ। ज़िम्मेदारी: {agency}। फ़ील्ड पेज पर "काम शुरू" और "काम पूरा" दबाएँ, और एक फ़ोटो जोड़ें।',
  },
  anti_burning_patrol: {
    type: 'anti_burning_patrol',
    labelEn: 'Anti-burning patrol',
    labelHi: 'आग रोकने की गश्त',
    shortEn: 'The anti-burning patrol',
    measurable: true,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. Patrol within about 1 km of the {area} monitoring station. Put out open fires: waste, leaves, tyres and guards\' bonfires. Responsible: {agency}. Tap Mark started and Mark done on the field page, and add one photo.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। {area} निगरानी स्टेशन के लगभग 1 किमी के दायरे में गश्त करें। खुले में जल रहा कचरा, पत्ते, टायर और अलाव बुझाएँ। ज़िम्मेदारी: {agency}। फ़ील्ड पेज पर "काम शुरू" और "काम पूरा" दबाएँ, और एक फ़ोटो जोड़ें।',
  },
  traffic_management: {
    type: 'traffic_management',
    labelEn: 'Traffic management',
    labelHi: 'यातायात प्रबंधन',
    shortEn: 'Traffic management',
    measurable: true,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. Clear the jams near the {area} monitoring station and divert heavy vehicles away from it. Responsible: {agency}. Tap Mark started and Mark done on the field page, and add one photo.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। {area} निगरानी स्टेशन के पास जाम खुलवाएँ और भारी वाहनों को दूसरे रास्ते से भेजें। ज़िम्मेदारी: {agency}। फ़ील्ड पेज पर "काम शुरू" और "काम पूरा" दबाएँ, और एक फ़ोटो जोड़ें।',
  },
  construction_inspection: {
    type: 'construction_inspection',
    labelEn: 'Construction inspection',
    labelHi: 'निर्माण स्थलों की जाँच',
    shortEn: 'Construction inspection',
    measurable: true,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. Inspect building sites within about 1 km of the {area} monitoring station. Check that loose material is covered and dust controls are running, and stop work that breaks the rules. Responsible: {agency}. Tap Mark started and Mark done on the field page, and add one photo.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। {area} निगरानी स्टेशन के लगभग 1 किमी के दायरे में निर्माण स्थलों की जाँच करें। देखें कि खुला माल ढका है और धूल रोकने के उपाय चल रहे हैं, और नियम तोड़ने वाला काम रुकवाएँ। ज़िम्मेदारी: {agency}। फ़ील्ड पेज पर "काम शुरू" और "काम पूरा" दबाएँ, और एक फ़ोटो जोड़ें।',
  },
  public_advisory: {
    type: 'public_advisory',
    labelEn: 'Public advisory',
    labelHi: 'जन सलाह',
    shortEn: 'The public advisory',
    measurable: false,
    templateEn: '{pollutant} reached {peak} µg/m³ at {area} at {time}{usual}. No local action will help. Keep windows closed, move activity indoors, and wear a well-fitted mask outside. Do not light any fires.',
    templateHi: '{area} में {time} {pollutant} {peak} µg/m³ तक पहुँचा{usual}। कोई स्थानीय उपाय मदद नहीं करेगा। खिड़कियाँ बंद रखें, काम घर के अंदर करें, और बाहर ठीक से लगने वाला मास्क पहनें। कोई आग न जलाएँ।',
  },
};

export const PLAYBOOKS: Record<Cause, Playbook> = {
  local_burning: {
    cause: 'local_burning',
    labelEn: 'Local burning',
    labelHi: 'आसपास कुछ जलाना',
    likelyEn: 'Local burning is the likely cause.',
    likelyHi: 'संभावित कारण आसपास कुछ जलाना है।',
    localActionPossible: true,
    steps: [
      { actionType: 'anti_burning_patrol', agency: 'MCD' },
      { actionType: 'anti_burning_patrol', agency: 'DPCC' },
    ],
    adviceEn: 'Keep windows closed tonight and report open fires.',
    adviceHi: 'आज रात खिड़कियाँ बंद रखें और खुले में आग की सूचना दें।',
  },
  dust: {
    cause: 'dust',
    labelEn: 'Dust',
    labelHi: 'धूल',
    likelyEn: 'Dust is the likely cause.',
    likelyHi: 'संभावित कारण धूल है।',
    localActionPossible: true,
    steps: [
      { actionType: 'water_sprinkling', agency: 'PWD' },
      { actionType: 'mechanical_sweeping', agency: 'MCD' },
      { actionType: 'construction_inspection', agency: 'DPCC' },
    ],
    adviceEn: 'Avoid busy roads and building sites, and wear a mask outside.',
    adviceHi: 'व्यस्त सड़कों और निर्माण स्थलों से बचें, और बाहर मास्क पहनें।',
  },
  traffic: {
    cause: 'traffic',
    labelEn: 'Traffic',
    labelHi: 'यातायात',
    likelyEn: 'Traffic is the likely cause.',
    likelyHi: 'संभावित कारण यातायात है।',
    localActionPossible: true,
    steps: [{ actionType: 'traffic_management', agency: 'Traffic Police' }],
    adviceEn: 'Avoid walking along main roads in rush hour.',
    adviceHi: 'भीड़ के समय मुख्य सड़कों के किनारे पैदल चलने से बचें।',
  },
  regional_smoke: {
    cause: 'regional_smoke',
    labelEn: 'Smoke from farm fires',
    labelHi: 'पराली के धुएँ',
    likelyEn: 'Smoke from farm fires upwind is the likely cause.',
    likelyHi: 'संभावित कारण हवा की दिशा में जल रही पराली का धुआँ है।',
    localActionPossible: false,
    steps: [{ actionType: 'public_advisory', agency: 'Residents' }],
    adviceEn: 'Keep windows closed, move activity indoors, and wear a well-fitted mask outside.',
    adviceHi: 'खिड़कियाँ बंद रखें, काम घर के अंदर करें, और बाहर ठीक से लगने वाला मास्क पहनें।',
    doNotEn: 'No local action will help. Do not deploy sprinklers.',
    doNotHi: 'कोई स्थानीय उपाय मदद नहीं करेगा। पानी का छिड़काव न करें।',
  },
  trapped_air: {
    cause: 'trapped_air',
    labelEn: 'Trapped air',
    labelHi: 'रुकी हुई हवा',
    likelyEn: 'Still air trapping pollution is the likely cause.',
    likelyHi: 'संभावित कारण रुकी हुई हवा है, जिसमें प्रदूषण फँस गया है।',
    localActionPossible: false,
    steps: [{ actionType: 'public_advisory', agency: 'Residents' }],
    adviceEn: 'Keep windows closed and avoid outdoor exercise until the wind picks up.',
    adviceHi: 'हवा चलने तक खिड़कियाँ बंद रखें और बाहर व्यायाम न करें।',
    doNotEn: 'No local action will help. Hold all burning until the air clears.',
    doNotHi: 'कोई स्थानीय उपाय मदद नहीं करेगा। हवा साफ़ होने तक कुछ भी न जलाएँ।',
  },
};

export const ALL_ACTIONS = Object.keys(ACTIONS) as ActionType[];

/** Actions an officer may issue for an incident with this cause (master PRD 4.6). */
export function allowedActions(cause: Cause): ActionType[] {
  return PLAYBOOKS[cause].localActionPossible ? ALL_ACTIONS : ['public_advisory'];
}

/** Default agency for an action under this cause: the playbook step if listed, else the first step that uses it. */
export function defaultAgency(cause: Cause, actionType: ActionType): Agency {
  const step = PLAYBOOKS[cause].steps.find((s) => s.actionType === actionType)
    ?? Object.values(PLAYBOOKS).flatMap((p) => p.steps).find((s) => s.actionType === actionType);
  return step?.agency ?? 'MCD';
}

export interface TemplateVars {
  area: string; time: string; pollutant: string; peak: string | number; usual: string; agency: string;
}

export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k as keyof TemplateVars]) : m);
}
