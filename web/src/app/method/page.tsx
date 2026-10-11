'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '../../lib/context';

export default function MethodPage() {
  const { dataset, lang } = useApp();

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      {/* Back link */}
      <div>
        <Link
          href={`/board?dataset=${dataset}`}
          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ink underline hover:opacity-80"
        >
          <span>&lt;</span>
          <span>{lang === 'hi' ? 'बोर्ड' : 'Board'}</span>
        </Link>
      </div>

      {/* Title */}
      <div>
        <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
          {lang === 'hi' ? 'कार्यप्रणाली' : 'Method'}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink mt-2 leading-tight">
          {lang === 'hi'
            ? 'Wajah संभावित कारण कैसे निर्धारित करता है, और कार्रवाई के असर की जाँच कैसे करता है।'
            : 'How Wajah names a likely cause, and how it checks whether the action worked.'}
        </h1>
        <p className="font-sans text-base text-ink-2 mt-3 leading-relaxed">
          {lang === 'hi'
            ? 'सार्वजनिक सेंसर डेटा पर आधारित स्पष्ट नियम। हर निष्कर्ष के पीछे के प्रमाण दिखाए जाते हैं, और अनिर्णायक होने पर स्पष्ट बताया जाता है।'
            : 'Plain rules on public sensor readings. Every answer shows the clues behind it, and says when it does not know.'}
        </p>
      </div>

      {/* 1. How a spike is detected */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          1 {lang === 'hi' ? 'प्रदूषण उछाल (Spike) की पहचान कैसे होती है' : 'How a spike is detected'}
        </h2>
        <p className="font-sans text-sm sm:text-base text-ink-2 leading-relaxed">
          {lang === 'hi'
            ? 'प्रत्येक क्षेत्र की रीडिंग की तुलना उसी घंटे के उसके सामान्य स्तर (पिछले 7 दिनों के औसत/मीडियन) से की जाती है। जब PM2.5 लगातार दो घंटों तक उस स्तर से काफी अधिक रहता है (कम से कम 90 µg/m³ और आधार रेखा से 1.5 गुना), तो Wajah एक घटना दर्ज करता है। रीडिंग सामान्य स्तर के करीब लौटने पर घटना समाप्त मानी जाती है।'
            : 'Each area\'s reading is compared with its own usual level (median over the previous 7 days) for that hour of the day. When PM2.5 stays well above that level (at least 90 µg/m³ and 1.5× baseline) for two consecutive hours, Wajah opens an incident. The incident ends when the reading comes back close to the usual level.'}
        </p>
      </section>

      {/* 2. The five causes and their clues */}
      <section className="space-y-4 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          2 {lang === 'hi' ? 'पाँच कारण और उनके संकेत' : 'The five causes and their clues'}
        </h2>
        <p className="font-sans text-sm text-ink-2">
          {lang === 'hi'
            ? 'Wajah लाइव सेंसर रीडिंग से प्रत्येक कारण का स्कोर निर्धारित करता है और उच्चतम स्कोर वाले को "संभावित" बताता है।'
            : 'Wajah scores each cause deterministically from live sensor readings and names the highest as “likely”.'}
        </p>

        <div className="space-y-3 font-sans text-sm">
          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '♨ आसपास कुछ जलाना' : '♨ Local burning'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'कणों के साथ कार्बन मोनोऑक्साइड (CO) बढ़ता है। हवा शांत रहती है। केवल एक या दो क्षेत्रों में उछाल दिखता है।'
                : 'Carbon monoxide (CO) rises with the particles. The wind is calm. Only one or two areas spike.'}
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '∴ धूल' : '∴ Dust'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'मोटे कण (PM10) अधिक होते हैं। हवा की गति धूल उड़ाने के लिए पर्याप्त तेज (≥ 4 m/s) होती है। कुछ ही क्षेत्रों में उछाल होता है।'
                : 'Coarse particles (PM10) dominate. Wind speed is strong enough (≥ 4 m/s) to lift dust. Few areas spike.'}
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '🚗 यातायात' : '🚗 Traffic'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'नाइट्रोजन डाइऑक्साइड (NO2) तेजी से बढ़ता है। उछाल सुबह या शाम के व्यस्त घंटों से मेल खाता है।'
                : 'Nitrogen dioxide (NO2) rises sharply. The spike coincides with morning or evening rush hours.'}
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '≈ पराली का धुआँ' : '≈ Smoke from farm fires'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'अधिकांश क्षेत्रों में एक साथ वृद्धि होती है। उपग्रह ऊपर की दिशा में (पंजाब/हरियाणा) आग की पहचान करते हैं, और हवा दिल्ली की ओर चलती है।'
                : 'Most areas rise together. Satellites detect active fires upwind (Punjab/Haryana), and winds blow towards Delhi.'}
            </div>
          </div>

          <div className="p-3 border border-rule bg-sheet">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '☁ रुकी हुई हवा' : '☁ Trapped air'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'अधिकांश क्षेत्रों में एक साथ वृद्धि होती है, आमतौर पर बहुत कम बाउंड्री लेयर ऊंचाई वाली शांत सर्दियों की रातों में।'
                : 'Most areas rise together, usually on calm winter nights with very low boundary layer height.'}
            </div>
          </div>

          <div className="p-3 border border-dashed border-ink bg-paper">
            <div className="font-serif font-bold text-base text-ink">
              {lang === 'hi' ? '? कारण स्पष्ट नहीं' : '? Cause unclear'}
            </div>
            <div className="text-ink-2 mt-1">
              {lang === 'hi'
                ? 'जब कोई भी कारण स्पष्ट रूप से आगे नहीं होता (स्कोर < 50 या अंतर < 20), तो Wajah स्पष्ट बता देता है और दो प्रमुख संभावनाओं को दिखाता है। यह अनुमान नहीं लगाता।'
                : 'When no cause scores clearly above the rest (score < 50 or difference < 20), Wajah says so and shows the two leading candidates. It does not guess.'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. How an action is judged */}
      <section className="space-y-4 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          3 {lang === 'hi' ? 'कार्रवाई का आकलन कैसे किया जाता है' : 'How an action is judged'}
        </h2>
        <p className="font-sans text-sm sm:text-base text-ink-2 leading-relaxed">
          {lang === 'hi'
            ? 'काम पूरा होने के तीन घंटे बाद, Wajah उस समय की सेंसर रीडिंग की तुलना काम खत्म होने के समय की रीडिंग से करता है। फिर यह उस गिरावट को घटाता है जो बिना किसी कार्रवाई के भी सामान्यतः देखी जाती। जो बचता है वह वास्तविक शुद्ध परिवर्तन (Net Change) है।'
            : 'Three hours after a job is marked done, Wajah compares the sensor reading with the reading when the job ended. Then it subtracts the drop that spikes at that hotspot usually show on their own when nobody acts. What remains is the true net change.'}
        </p>

        {/* Diagram illustration */}
        <div className="p-4 border-2 border-ink bg-sheet space-y-3 font-mono text-xs">
          <div className="flex justify-between items-center text-ink-3">
            <span>{lang === 'hi' ? 'पहले: 430' : 'Before: 430'}</span>
            <span>{lang === 'hi' ? 'बाद में: 290 (−33%)' : 'After: 290 (−33%)'}</span>
          </div>
          <div className="border-t border-ink relative py-2">
            <div className="text-center font-bold text-ink">
              {lang === 'hi' ? 'शुद्ध बदलाव: −23%' : 'Net change: −23%'}
            </div>
            <div className="text-center text-[11px] text-ink-3">
              {lang === 'hi' ? 'हॉटस्पॉट गिरावट (−33%) में से सामान्य गिरावट (−10%) घटाकर' : 'Hotspot drop (−33%) less usual fade (−10%)'}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 bg-ink text-white font-bold flex items-center justify-between">
            <span>✓ {lang === 'hi' ? 'असर हुआ' : 'Worked'}</span>
            <span>{lang === 'hi' ? '15% या अधिक की शुद्ध गिरावट।' : 'A net drop of 15% or more.'}</span>
          </div>
          <div className="p-2.5 bg-ink text-white font-bold flex items-center justify-between">
            <span>✕ {lang === 'hi' ? 'असर नहीं हुआ' : 'No effect'}</span>
            <span>{lang === 'hi' ? '15% से कम की गिरावट।' : 'Less than a 15% drop.'}</span>
          </div>
          <div className="p-2.5 border border-dashed border-ink bg-paper font-bold flex items-center justify-between">
            <span>? {lang === 'hi' ? 'अनिर्णायक' : 'Inconclusive'}</span>
            <span>{lang === 'hi' ? 'बारिश, तेज हवा में बदलाव, या पूरे शहर में एक साथ बदलाव।' : 'Rain, high wind shift, or whole city shifted at once.'}</span>
          </div>
        </div>
      </section>

      {/* 4. The Placebo Test */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          4 {lang === 'hi' ? 'प्लेसिबो परीक्षण' : 'The placebo test'}
        </h2>
        <p className="font-sans text-sm text-ink-2 leading-relaxed">
          {lang === 'hi'
            ? 'यह परखने के लिए कि यह माप पद्धति कितनी बार गलत परिणाम देती है, हमने अतीत के वास्तविक उछालों पर 24 नकली कार्य आदेश दर्ज किए जहाँ वास्तव में कुछ नहीं किया गया था।'
            : 'To test how often this measurement method fools itself, we logged 24 fake work orders on real past spikes where nothing was actually done.'}
        </p>
        <div className="p-3 border-2 border-ink bg-sheet font-mono text-sm font-bold text-ink">
          {lang === 'hi'
            ? '24 में से 2 नकली कार्रवाइयों को गलती से सफल चिह्नित किया गया।'
            : '2 of 24 fake actions were wrongly marked as worked.'}
        </div>
        <p className="font-sans text-xs text-ink-2 leading-relaxed">
          {lang === 'hi'
            ? 'मौसम के बदलावों के शोर के कारण बिना कुछ किए भी लगभग 12 में से 1 बार सफलता का दावा हो सकता है। इसीलिए Wajah हमेशा संख्या (जैसे "4 में से 3 बार") दिखाता है, न कि केवल एक अकेला प्रतिशत।'
            : 'With nothing done at all, the method still claims success about 1 in 12 times due to turbulent weather noise. That is why Wajah always shows counts (such as “3 of 4 times”) rather than a single percentage in isolation.'}
        </p>
      </section>

      {/* Honest Limits Box */}
      <div className="border-2 border-ink bg-sheet p-6 space-y-3">
        <h3 className="font-serif text-xl font-bold text-ink">
          {lang === 'hi' ? 'इसकी क्या सीमाएं हैं' : 'What this cannot tell you'}
        </h3>
        <ul className="space-y-2 font-sans text-xs sm:text-sm text-ink-2">
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span>
              <strong>{lang === 'hi' ? 'संकेत पूर्ण प्रमाण नहीं हैं।' : 'Clues are not proof.'}</strong>{' '}
              {lang === 'hi'
                ? 'संभावित कारण वर्तमान रीडिंग का सबसे सटीक अनुमान है, अंतिम सत्य नहीं।'
                : 'A likely cause is the best fit to current readings, not a finding of fact.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span>
              <strong>{lang === 'hi' ? 'एक परिणाम कमजोर साक्ष्य है।' : 'One result is weak evidence.'}</strong>{' '}
              {lang === 'hi'
                ? 'एक रीडिंग के बजाय कई प्रयासों के पैटर्न पर भरोसा करें।'
                : 'Trust a pattern over multiple interventions, not a single reading.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span>
              <strong>{lang === 'hi' ? 'सेंसर 1 किमी दूर हो सकते हैं।' : 'Stations can be 1 km away.'}</strong>{' '}
              {lang === 'hi'
                ? 'छिड़काव उस सड़क पर असर कर सकता है जिसे स्टेशन नहीं देख पाता।'
                : 'Sprinkling may help a street the station cannot see.'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-ink">✕</span>
            <span>
              <strong>{lang === 'hi' ? 'इस डेमो में कार्य आदेश सिम्युलेटेड हैं।' : 'Work orders in this demo are simulated.'}</strong>{' '}
              {lang === 'hi'
                ? 'इनमें DEMO का टैग है। वास्तव में कोई ट्रक नहीं भेजा गया था।'
                : 'They carry a DEMO tag. No real trucks were dispatched.'}
            </span>
          </li>
        </ul>
      </div>

      {/* 5. Data sources */}
      <section className="space-y-3 border-t-2 border-ink pt-6">
        <h2 className="font-serif text-2xl font-extrabold text-ink">
          5 {lang === 'hi' ? 'डेटा स्रोत' : 'Data sources'}
        </h2>
        <div className="border border-rule divide-y divide-rule font-sans text-xs bg-sheet">
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">
              {lang === 'hi' ? 'वायु गुणवत्ता' : 'Air Quality'}
            </span>
            <span className="text-ink-2">CPCB public stations &amp; OpenAQ v3 hourly feed</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">
              {lang === 'hi' ? 'मौसम व वायुमंडलीय परत' : 'Weather & Boundary Layer'}
            </span>
            <span className="text-ink-2">Open-Meteo hourly weather model</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">
              {lang === 'hi' ? 'पराली की आग' : 'Farm Fire Detections'}
            </span>
            <span className="text-ink-2">NASA FIRMS satellite area detections (SNPP NRT)</span>
          </div>
          <div className="p-3 flex justify-between">
            <span className="font-bold text-ink">
              {lang === 'hi' ? 'नक्शा आधार' : 'Map Base'}
            </span>
            <span className="text-ink-2">&copy; OpenStreetMap contributors</span>
          </div>
        </div>
      </section>
    </div>
  );
}
