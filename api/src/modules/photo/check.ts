// A7.2: check that a completion photo shows the kind of work ordered. Never blocks: any failure is 'unclear'.
// Uses the Gemini SDK directly for this one image request (track A section 9 allows it), same model as the agent.
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GoogleGenAI } from '@google/genai';
import { ACTIONS, config, type ActionType, type PhotoCheck } from '@wajah/shared';

let s3: S3Client | undefined;
const UNCHECKED = 'Photo could not be checked';

// What counts as visible work, per action (the check confirms the kind of work, not place or time)
const EVIDENCE: Record<ActionType, string> = {
  water_sprinkling: 'water visibly spraying onto a road, or a freshly wet road behind a water tanker',
  mechanical_sweeping: 'a road-sweeping machine or workers sweeping a road',
  anti_burning_patrol: 'officials or workers putting out or checking an open fire, or a freshly extinguished fire',
  traffic_management: 'traffic police directing vehicles or clearing a jam',
  construction_inspection: 'officials inspecting a building site, or covered building material and dust controls',
  public_advisory: 'a public notice, announcement or advisory',
};
// Image judgement needs the stronger model; one call per photo fits the free quota
const PHOTO_MODEL = 'gemini-3.5-flash';

export function photoPrompt(actionType: ActionType, area: string): string {
  return `A field team was asked to do this: ${ACTIONS[actionType].labelEn} at ${area}. Does this photo show that kind of work? `
    + `Answer "pass" only if the work itself is visibly being done or has just been done (${EVIDENCE[actionType]}). `
    + 'If the right kind of vehicle or equipment is present but the work is not visible, answer "unclear". If the photo shows something else, answer "fail". '
    + 'Reply with JSON only: { "result": "pass" or "fail" or "unclear", "note": one short sentence saying what the photo shows }.';
}

/** Parse the model's reply; anything unexpected becomes unclear. */
export function parseVerdict(key: string, text: string): PhotoCheck {
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : text) as { result?: string; note?: string };
    if (j.result === 'pass' || j.result === 'fail' || j.result === 'unclear') {
      return { key, result: j.result, note: String(j.note ?? '').trim().slice(0, 200) || 'No note given.' };
    }
  } catch { /* fall through */ }
  return { key, result: 'unclear', note: UNCHECKED };
}

async function readImage(key: string): Promise<Buffer> {
  const bucket = process.env.EVIDENCE_BUCKET;
  if (!bucket) throw new Error('EVIDENCE_BUCKET is not set');
  s3 ??= new S3Client({});
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function checkPhoto(key: string, actionType: ActionType, area: string, image?: Buffer): Promise<PhotoCheck> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');
    const bytes = image ?? (await readImage(key));
    const ai = new GoogleGenAI({ apiKey });
    const call = ai.models.generateContent({
      model: process.env.PHOTO_MODEL_ID || PHOTO_MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } }, { text: photoPrompt(actionType, area) }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('photo check timed out')), config.photo.checkTimeoutMs));
    const res = await Promise.race([call, timeout]);
    return parseVerdict(key, res.text ?? '');
  } catch (e) {
    console.log(JSON.stringify({ level: 'error', step: 'photo_check', key, message: (e as Error).message }));
    return { key, result: 'unclear', note: UNCHECKED };
  }
}
