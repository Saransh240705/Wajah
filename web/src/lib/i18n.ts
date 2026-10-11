import type { ActionType, Cause, IncidentStatus, Verdict } from '@wajah/shared';

export type TranslationKey =
  | 'nav_board'
  | 'nav_map'
  | 'nav_ledger'
  | 'nav_ask'
  | 'nav_method'
  | 'step_detect'
  | 'step_diagnose'
  | 'step_prescribe'
  | 'step_act'
  | 'step_prove'
  | 'status_open'
  | 'status_dispatched'
  | 'status_cleared'
  | 'status_recurred'
  | 'verdict_worked'
  | 'verdict_no_effect'
  | 'verdict_inconclusive'
  | 'verdict_not_measured'
  | 'field_start'
  | 'field_done'
  | 'field_add_photo'
  | 'field_retry'
  | 'field_started_at'
  | 'field_done_at'
  | 'field_photo_added_at'
  | 'field_what_to_do'
  | 'field_why'
  | 'field_responsibility'
  | 'field_completed_banner'
  | 'field_thank_you'
  | 'issue_work_order'
  | 'issue_public_advisory'
  | 'measure_now'
  | 'copy_field_link'
  | 'link_copied'
  | 'open_incident'
  | 'open_board'
  | 'open_full_map'
  | 'open_full_ledger'
  | 'ask_why'
  | 'write_brief'
  | 'refresh'
  | 'live'
  | 'replay'
  | 'replay_banner'
  | 'data_sources'
  | 'method_link'
  | 'hotspot'
  | 'comparison_station'
  | 'work_orders_issued'
  | 'actions_measured'
  | 'actions_worked'
  | 'of_measured'
  | 'more_waiting'
  | 'days_7'
  | 'days_14'
  | 'all'
  | 'all_delhi'
  | 'what_was_tried'
  | 'tried'
  | 'average_net_change'
  | 'placebo_test'
  | 'repeat_problem_areas'
  | 'incidents'
  | 'mostly'
  | 'where_they_are'
  | 'map_legend_title'
  | 'active_incidents'
  | 'ask_wajah_title'
  | 'ask_wajah_sub'
  | 'try_one_of_these'
  | 'ask_input_placeholder'
  | 'evidence_title'
  | 'ask_another'
  | 'before'
  | 'after'
  | 'expected_fade'
  | 'net_change'
  | 'did_it_stay_away'
  | 'instructions';

const dictionary: Record<'en' | 'hi', Record<string, string>> = {
  en: {
    nav_board: 'Board',
    nav_map: 'Map',
    nav_ledger: 'Ledger',
    nav_ask: 'Ask',
    nav_method: 'Method',
    step_detect: 'Detect',
    step_diagnose: 'Diagnose',
    step_prescribe: 'Prescribe',
    step_act: 'Act',
    step_prove: 'Prove',
    status_open: 'OPEN',
    status_dispatched: 'DISPATCHED',
    status_cleared: 'CLEARED',
    status_recurred: 'RECURRED',
    verdict_worked: 'Worked',
    verdict_no_effect: 'No effect',
    verdict_inconclusive: 'Inconclusive',
    verdict_not_measured: 'Not measured',
    field_start: 'Mark started',
    field_done: 'Mark done',
    field_add_photo: 'Add photo',
    field_retry: 'Try again',
    field_started_at: 'Started at',
    field_done_at: 'Completed at',
    field_photo_added_at: 'Photo added at',
    field_what_to_do: 'What to do',
    field_why: 'Why',
    field_responsibility: 'Responsibility',
    field_completed_banner: 'This work order is complete and cannot be edited.',
    field_thank_you: 'Thank you. Sensors will measure the result in about 3 hours.',
    issue_work_order: 'Issue work order',
    issue_public_advisory: 'Issue public advisory',
    measure_now: 'Measure now',
    copy_field_link: 'Copy field link',
    link_copied: 'Copied!',
    open_incident: 'Open incident',
    open_board: 'Open board',
    open_full_map: 'Open the full map',
    open_full_ledger: 'Open the full ledger',
    ask_why: 'Ask why',
    write_brief: 'Write the brief',
    refresh: 'Refresh',
    live: 'Live',
    replay: 'Replay',
    replay_banner: 'REPLAY · recorded readings, not live',
    data_sources: 'Data sources: CPCB / OpenAQ · Open-Meteo · NASA FIRMS · © OpenStreetMap',
    method_link: 'How Wajah diagnoses and measures',
    hotspot: 'Hotspot',
    comparison_station: 'Comparison station',
    work_orders_issued: 'work orders issued',
    actions_measured: 'actions measured',
    actions_worked: 'actions that worked',
    of_measured: 'Of the measured:',
    more_waiting: 'more waiting to be measured.',
    days_7: '7 days',
    days_14: '14 days',
    all: 'All',
    all_delhi: 'All Delhi',
    what_was_tried: 'WHAT WAS TRIED, AND HOW OFTEN IT WORKED',
    tried: 'Tried',
    average_net_change: 'Average net change',
    placebo_test: 'PLACEBO TEST',
    repeat_problem_areas: 'REPEAT PROBLEM AREAS',
    incidents: 'incidents',
    mostly: 'mostly',
    where_they_are: 'WHERE THEY ARE',
    map_legend_title: 'READING THE MAP',
    active_incidents: 'ACTIVE INCIDENTS',
    ask_wajah_title: 'Ask Wajah',
    ask_wajah_sub: 'Ask why the air turned bad, or what to do next.',
    try_one_of_these: 'TRY ONE OF THESE',
    ask_input_placeholder: 'Ask why or what to do...',
    evidence_title: 'EVIDENCE',
    ask_another: 'Ask another question',
    before: 'Before',
    after: 'After',
    expected_fade: 'Expected fade',
    net_change: 'Net change',
    did_it_stay_away: 'DID IT STAY AWAY',
    instructions: 'INSTRUCTIONS',
  },
  hi: {
    nav_board: 'बोर्ड',
    nav_map: 'नक्शा',
    nav_ledger: 'रिकॉर्ड',
    nav_ask: 'पूछें',
    nav_method: 'विधि',
    step_detect: 'पहचान',
    step_diagnose: 'कारण',
    step_prescribe: 'उपाय',
    step_act: 'कार्रवाई',
    step_prove: 'परिणाम',
    status_open: 'नया',
    status_dispatched: 'आदेश जारी',
    status_cleared: 'ठीक हुआ',
    status_recurred: 'फिर हुआ',
    verdict_worked: 'असर हुआ',
    verdict_no_effect: 'असर नहीं हुआ',
    verdict_inconclusive: 'स्पष्ट नहीं',
    verdict_not_measured: 'मापा नहीं गया',
    field_start: 'काम शुरू किया',
    field_done: 'काम पूरा किया',
    field_add_photo: 'फ़ोटो जोड़ें',
    field_retry: 'फिर कोशिश करें',
    field_started_at: 'काम शुरू किया',
    field_done_at: 'काम पूरा किया',
    field_photo_added_at: 'फ़ोटो जोड़ी गई',
    field_what_to_do: 'क्या करना है',
    field_why: 'क्यों',
    field_responsibility: 'ज़िम्मेदारी',
    field_completed_banner: 'यह आदेश पूरा हो चुका है। अब इसमें बदलाव नहीं हो सकता।',
    field_thank_you: 'धन्यवाद। लगभग 3 घंटे में सेंसर से परिणाम मापा जाएगा।',
    issue_work_order: 'कार्य आदेश जारी करें',
    issue_public_advisory: 'जन सलाह जारी करें',
    measure_now: 'परिणाम मापें',
    copy_field_link: 'फ़ील्ड लिंक कॉपी करें',
    link_copied: 'कॉपी हो गया!',
    open_incident: 'घटना खोलें',
    open_board: 'बोर्ड खोलें',
    open_full_map: 'पूरा नक्शा देखें',
    open_full_ledger: 'पूरा रिकॉर्ड देखें',
    ask_why: 'कारण पूछें',
    write_brief: 'संक्षिप्त रिपोर्ट लिखें',
    refresh: 'ताज़ा करें',
    live: 'लाइव',
    replay: 'रीप्ले',
    replay_banner: 'रीप्ले · दर्ज की गई रीडिंग, लाइव नहीं',
    data_sources: 'डेटा स्रोत: CPCB / OpenAQ · Open-Meteo · NASA FIRMS · © OpenStreetMap',
    method_link: 'Wajah विधि एवं सीमाएं',
    hotspot: 'हॉटस्पॉट',
    comparison_station: 'तुलना स्टेशन',
    work_orders_issued: 'कार्य आदेश जारी किए गए',
    actions_measured: 'मापी गई कार्रवाइयां',
    actions_worked: 'सफल कार्रवाइयां',
    of_measured: 'मापे गए में से:',
    more_waiting: 'और मापे जाने की प्रतीक्षा में।',
    days_7: '7 दिन',
    days_14: '14 दिन',
    all: 'सभी',
    all_delhi: 'पूरा दिल्ली',
    what_was_tried: 'क्या उपाय किए गए, और वे कितनी बार सफल रहे',
    tried: 'प्रयास किया',
    average_net_change: 'औसत शुद्ध परिवर्तन',
    placebo_test: 'प्लेसिबो परीक्षण',
    repeat_problem_areas: 'बार-बार समस्या वाले क्षेत्र',
    incidents: 'घटनाएं',
    mostly: 'अधिकतर',
    where_they_are: 'स्थान / कहाँ हैं',
    map_legend_title: 'नक्शा कैसे पढ़ें',
    active_incidents: 'सक्रिय घटनाएं',
    ask_wajah_title: 'Wajah से पूछें',
    ask_wajah_sub: 'पूछें कि हवा क्यों खराब हुई, या आगे क्या कदम उठाएं।',
    try_one_of_these: 'इनमें से कोई प्रश्न पूछें',
    ask_input_placeholder: 'आगे पूछें कि क्या हुआ या क्या करना है...',
    evidence_title: 'प्रमाण (EVIDENCE)',
    ask_another: 'नया सवाल पूछें',
    before: 'पहले',
    after: 'बाद में',
    expected_fade: 'अपेक्षित गिरावट',
    net_change: 'शुद्ध परिवर्तन',
    did_it_stay_away: 'क्या प्रदूषण दोबारा बढ़ा?',
    instructions: 'निर्देश',
  },
};

export function t(key: TranslationKey | string, lang: 'en' | 'hi' = 'en'): string {
  return dictionary[lang]?.[key] ?? dictionary.en[key] ?? key;
}

export function causeLabel(cause: Cause, lang: 'en' | 'hi' = 'en'): string {
  const map: Record<Cause, { en: string; hi: string }> = {
    local_burning: { en: 'Likely local burning', hi: 'संभावित कारण आसपास कुछ जलाना' },
    dust: { en: 'Likely dust', hi: 'संभावित कारण धूल' },
    traffic: { en: 'Likely traffic', hi: 'संभावित कारण यातायात' },
    regional_smoke: { en: 'Likely smoke from farm fires', hi: 'संभावित कारण पराली का धुआँ' },
    trapped_air: { en: 'Likely trapped air', hi: 'संभावित कारण रुकी हुई हवा' },
  };
  return map[cause]?.[lang] ?? cause;
}

export function actionLabel(action: ActionType, lang: 'en' | 'hi' = 'en'): string {
  const map: Record<ActionType, { en: string; hi: string }> = {
    water_sprinkling: { en: 'Water sprinkling', hi: 'पानी का छिड़काव' },
    mechanical_sweeping: { en: 'Mechanical sweeping', hi: 'मशीन से सड़क की सफ़ाई' },
    anti_burning_patrol: { en: 'Anti-burning patrol', hi: 'आग रोकने की गश्त' },
    traffic_management: { en: 'Traffic management', hi: 'यातायात प्रबंधन' },
    construction_inspection: { en: 'Construction inspection', hi: 'निर्माण स्थलों की जाँच' },
    public_advisory: { en: 'Public advisory', hi: 'जन सलाह' },
  };
  return map[action]?.[lang] ?? action;
}

export function verdictLabel(verdict: Verdict | string, lang: 'en' | 'hi' = 'en'): string {
  const map: Record<string, { en: string; hi: string }> = {
    worked: { en: 'Worked', hi: 'असर हुआ' },
    no_effect: { en: 'No effect', hi: 'असर नहीं हुआ' },
    inconclusive: { en: 'Inconclusive', hi: 'स्पष्ट नहीं' },
    not_measured: { en: 'Not measured', hi: 'मापा नहीं गया' },
  };
  return map[verdict]?.[lang] ?? verdict;
}

export function statusLabel(status: IncidentStatus | string, lang: 'en' | 'hi' = 'en'): string {
  const map: Record<string, { en: string; hi: string }> = {
    open: { en: 'OPEN', hi: 'नया' },
    dispatched: { en: 'DISPATCHED', hi: 'आदेश जारी' },
    cleared: { en: 'CLEARED', hi: 'ठीक हुआ' },
    recurred: { en: 'RECURRED', hi: 'फिर हुआ' },
  };
  return map[status]?.[lang] ?? status;
}

export function bandLabel(band: string | null | undefined, lang: 'en' | 'hi' = 'en'): string {
  if (!band) return '';
  const normalized = band.toLowerCase().replace('-', '_');
  const map: Record<string, { en: string; hi: string }> = {
    good: { en: 'Good', hi: 'अच्छा' },
    satisfactory: { en: 'Satisfactory', hi: 'संतोषजनक' },
    moderate: { en: 'Moderate', hi: 'मध्यम' },
    poor: { en: 'Poor', hi: 'खराब' },
    very_poor: { en: 'Very poor', hi: 'बहुत खराब' },
    severe: { en: 'Severe', hi: 'गंभीर' },
  };
  return map[normalized]?.[lang] ?? (band.charAt(0).toUpperCase() + band.slice(1).replace('_', ' '));
}

export function confidenceLabel(conf: string, lang: 'en' | 'hi' = 'en'): string {
  const map: Record<string, { en: string; hi: string }> = {
    high: { en: 'high', hi: 'उच्च' },
    medium: { en: 'medium', hi: 'मध्यम' },
    low: { en: 'low', hi: 'कम' },
  };
  return map[conf]?.[lang] ?? conf;
}

// ---------------------------------------------------------------------------------------------------------------
// Server text in Hindi. The API sends some text in English only (evidence clues, recommendation reasons, grouped
// board labels, station names). These helpers render it in Hindi from fixed server patterns; anything unknown falls
// back to the original English rather than guessing.
// ---------------------------------------------------------------------------------------------------------------

const AREA_HI: Record<string, string> = {
  'Anand Vihar': 'आनंद विहार', Mundka: 'मुंडका', Wazirpur: 'वज़ीरपुर', Jahangirpuri: 'जहाँगीरपुरी', 'R K Puram': 'आर के पुरम',
  Rohini: 'रोहिणी', 'Punjabi Bagh': 'पंजाबी बाग', Okhla: 'ओखला', Bawana: 'बवाना', Narela: 'नरेला', 'Vivek Vihar': 'विवेक विहार',
  Dwarka: 'द्वारका', 'Ashok Vihar': 'अशोक विहार', 'Lodhi Road': 'लोधी रोड', ITO: 'आईटीओ', 'Mandir Marg': 'मंदिर मार्ग',
  Sirifort: 'सीरी फोर्ट', Alipur: 'अलीपुर', 'Aya Nagar': 'आया नगर', 'Burari Crossing': 'बुराड़ी क्रॉसिंग', 'Mathura Road': 'मथुरा रोड',
  'Chandni Chowk': 'चांदनी चौक', DTU: 'डीटीयू', 'Karni Singh Range': 'करणी सिंह रेंज', 'IGI Airport': 'आईजीआई हवाई अड्डा',
  'Dilshad Garden': 'दिलशाद गार्डन', 'Jawaharlal Nehru Stadium': 'जवाहरलाल नेहरू स्टेडियम', 'National Stadium': 'नेशनल स्टेडियम',
  'NSIT Dwarka': 'एनएसआईटी द्वारका', Najafgarh: 'नजफ़गढ़', 'Nehru Nagar': 'नेहरू नगर', 'North Campus': 'नॉर्थ कैंपस',
  Patparganj: 'पटपड़गंज', Pusa: 'पूसा', Shadipur: 'शादीपुर', 'Sonia Vihar': 'सोनिया विहार', 'Sri Aurobindo Marg': 'श्री अरबिंदो मार्ग',
};

/** Area label, including the board's grouped "N areas at once, highest at X". */
export function areaLabel(area: string | null | undefined, lang: 'en' | 'hi' = 'en'): string {
  if (!area) return '';
  if (lang !== 'hi') return area;
  const grouped = area.match(/^(\d+) areas at once, highest at (.+)$/);
  if (grouped) return `${grouped[1]} क्षेत्र एक साथ, सबसे अधिक ${AREA_HI[grouped[2]!] ?? grouped[2]} में`;
  return AREA_HI[area] ?? area;
}

const CHIP_TITLE: Record<string, { en: string; hi: string }> = {
  pm_ratio_fine: { en: 'Particle size', hi: 'कणों का आकार' },
  pm_ratio_smoke: { en: 'Particle size', hi: 'कणों का आकार' },
  pm_ratio_coarse: { en: 'Particle size', hi: 'कणों का आकार' },
  pm_ratio_mixed: { en: 'Particle size', hi: 'कणों का आकार' },
  co_rise: { en: 'Carbon monoxide', hi: 'कार्बन मोनोऑक्साइड' },
  co_rise_traffic: { en: 'Carbon monoxide', hi: 'कार्बन मोनोऑक्साइड' },
  co_flat: { en: 'Carbon monoxide', hi: 'कार्बन मोनोऑक्साइड' },
  no2_rise: { en: 'Nitrogen dioxide', hi: 'नाइट्रोजन डाइऑक्साइड' },
  co_no2_rise: { en: 'CO and NO2', hi: 'CO और NO2' },
  few_areas: { en: 'Areas that spiked', hi: 'कितने क्षेत्रों में बढ़ा' },
  some_areas: { en: 'Areas that spiked', hi: 'कितने क्षेत्रों में बढ़ा' },
  most_areas: { en: 'Areas that spiked', hi: 'कितने क्षेत्रों में बढ़ा' },
  wind_strong: { en: 'Wind', hi: 'हवा' },
  wind_calm: { en: 'Wind', hi: 'हवा' },
  wind_from_northwest: { en: 'Wind direction', hi: 'हवा की दिशा' },
  low_mixing: { en: 'Air ceiling', hi: 'हवा की परत' },
  upwind_fires: { en: 'Farm fires upwind', hi: 'हवा की दिशा में पराली की आग' },
  upwind_fires_many: { en: 'Farm fires upwind', hi: 'हवा की दिशा में पराली की आग' },
  few_upwind_fires: { en: 'Farm fires upwind', hi: 'हवा की दिशा में पराली की आग' },
  few_fires: { en: 'Farm fires upwind', hi: 'हवा की दिशा में पराली की आग' },
  night: { en: 'Time of day', hi: 'समय' },
  rush_hour: { en: 'Time of day', hi: 'समय' },
  daytime: { en: 'Time of day', hi: 'समय' },
};

/** Short title for an evidence clue (instead of the raw rule key). */
export function chipTitle(key: string, lang: 'en' | 'hi' = 'en'): string {
  return CHIP_TITLE[key]?.[lang] ?? key.replace(/_/g, ' ');
}

const BAND_HI: Record<string, string> = { night: 'रात में', 'morning rush': 'सुबह की भीड़ के समय', 'evening rush': 'शाम की भीड़ के समय', day: 'दिन में' };

/** Evidence clue sentence. The API's labels are English; in Hindi, rebuild the sentence from the rule and its value. */
export function chipLabel(chip: { key: string; label: string; value: string }, lang: 'en' | 'hi' = 'en'): string {
  if (lang !== 'hi') return chip.label;
  const v = chip.value;
  // "10 of 36" -> "36 में से 10"
  const of = v.match(/^(\d+) of (\d+)$/);
  const areas = of ? `${of[2]} में से ${of[1]}` : v;
  switch (chip.key) {
    case 'pm_ratio_fine':
    case 'pm_ratio_smoke': return `बारीक कण ज़्यादा: PM2.5, PM10 का ${v} गुना है`;
    case 'pm_ratio_coarse': return `मोटे कण ज़्यादा: PM2.5, PM10 का केवल ${v} गुना है`;
    case 'pm_ratio_mixed': return `मिले-जुले आकार के कण: PM2.5, PM10 का ${v} गुना है`;
    case 'co_rise':
    case 'co_rise_traffic': return `CO सामान्य स्तर से ${v} बढ़ा`;
    case 'co_flat': return `CO लगभग सामान्य स्तर पर (${v})`;
    case 'no2_rise': return `NO2 सामान्य स्तर से ${v} बढ़ा`;
    case 'co_no2_rise': return `CO और NO2 दोनों बढ़े: ${v.replace(', ', ' और ')}`;
    case 'few_areas':
    case 'some_areas': return of ? `${of[2]} में से केवल ${of[1]} क्षेत्रों में बढ़ा` : `केवल ${areas} क्षेत्रों में बढ़ा`;
    case 'most_areas': return `${areas} क्षेत्रों में एक साथ बढ़ा`;
    case 'wind_strong': return `हवा ${v}, धूल उड़ाने लायक तेज़`;
    case 'wind_calm': return `हवा लगभग थमी हुई, ${v}`;
    case 'low_mixing': return `हवा ज़मीन के पास फँसी: हवा की परत केवल ${v} गहरी`;
    case 'wind_from_northwest': return `हवा उत्तर-पश्चिम (${v}) से, पराली की आग की दिशा से`;
    case 'upwind_fires':
    case 'upwind_fires_many': return `पिछले 48 घंटों में हवा की दिशा में ${v} जगह पराली की आग`;
    case 'few_upwind_fires':
    case 'few_fires': return `हवा की दिशा में केवल ${v} जगह पराली की आग`;
    case 'night':
    case 'rush_hour':
    case 'daytime': return `सबसे ज़्यादा स्तर ${BAND_HI[v] ?? v}`;
    default: return chip.label;
  }
}

const CAUSE_EN_HI: Record<string, string> = {
  'Local burning': 'आसपास कुछ जलाना', Dust: 'धूल', Traffic: 'यातायात', 'Smoke from farm fires': 'पराली का धुआँ', 'Trapped air': 'रुकी हुई हवा',
  'Still air trapping pollution': 'रुकी हुई हवा',
};
const ACTION_EN_HI: Record<string, string> = {
  'Water sprinkling': 'पानी का छिड़काव', Sprinkling: 'पानी का छिड़काव', 'Mechanical sweeping': 'मशीन से सड़क की सफ़ाई',
  'Anti-burning patrol': 'आग रोकने की गश्त', 'The anti-burning patrol': 'आग रोकने की गश्त', 'Traffic management': 'यातायात प्रबंधन',
  'Construction inspection': 'निर्माण स्थलों की जाँच', 'Public advisory': 'जन सलाह', 'The public advisory': 'जन सलाह',
};
const hiCause = (s: string) => CAUSE_EN_HI[s] ?? CAUSE_EN_HI[s.charAt(0).toUpperCase() + s.slice(1)] ?? s;
const hiAction = (s: string) => ACTION_EN_HI[s] ?? ACTION_EN_HI[s.charAt(0).toUpperCase() + s.slice(1)] ?? s;

/** Recommendation reason sentences (built on the server from fixed templates). */
export function reasonText(reason: string | null | undefined, lang: 'en' | 'hi' = 'en'): string {
  if (!reason) return '';
  if (lang !== 'hi') return reason;
  const sentences = reason.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  const out = sentences.map((s) => {
    let m: RegExpMatchArray | null;
    if (s === 'No local action will help.') return 'कोई स्थानीय उपाय मदद नहीं करेगा।';
    if (s === 'Do not deploy sprinklers.') return 'पानी का छिड़काव न करें।';
    if (s === 'Hold all burning until the air clears.') return 'हवा साफ़ होने तक कुछ भी न जलाएँ।';
    if ((m = s.match(/^(.+) upwind is the likely cause\.$/))) return `संभावित कारण हवा की दिशा में ${hiCause(m[1]!)} है।`;
    if ((m = s.match(/^(.+) is the likely cause\.$/))) return `संभावित कारण ${hiCause(m[1]!)} है।`;
    if ((m = s.match(/^(.+?)(?: here)? has not been tried here yet\.$/))) return `${hiAction(m[1]!)} यहाँ अभी तक आज़माया नहीं गया।`;
    if ((m = s.match(/^(.+?)(?: here)? has no measured result here yet\.$/))) return `${hiAction(m[1]!)} का यहाँ अभी तक कोई मापा गया परिणाम नहीं है।`;
    if ((m = s.match(/^(.+?)(?: here)? worked(?: here)? (\d+) of (\d+) times\.$/))) return `${hiAction(m[1]!)} से यहाँ ${m[3]} में से ${m[2]} बार असर हुआ।`;
    if ((m = s.match(/^(.+?)(?: here)? had no effect(?: here)? (\d+) of (\d+) times(?:, so try (.+))?\.$/)))
      return `${hiAction(m[1]!)} से यहाँ ${m[3]} में से ${m[2]} बार असर नहीं हुआ${m[4] ? `, इसलिए ${hiAction(m[4])} आज़माएँ` : ''}।`;
    if ((m = s.match(/^(.+?) had no effect here (\d+) times\.$/))) return `${hiAction(m[1]!)} से यहाँ ${m[2]} बार असर नहीं हुआ।`;
    if ((m = s.match(/^Try (.+)\.$/))) return `${hiAction(m[1]!)} आज़माएँ।`;
    return s;
  });
  return out.join(' ');
}

/** Hindi instructions from the server carry the English place name; show the Hindi one. */
export function instructionsText(wo: { area: string; instructionsEn: string; instructionsHi: string }, lang: 'en' | 'hi' = 'en'): string {
  if (lang !== 'hi') return wo.instructionsEn;
  const hi = areaLabel(wo.area, 'hi');
  return hi && hi !== wo.area ? wo.instructionsHi.split(wo.area).join(hi) : wo.instructionsHi;
}
