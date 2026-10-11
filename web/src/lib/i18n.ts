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
  | 'refresh';

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
