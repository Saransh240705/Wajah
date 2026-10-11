import { describe, expect, it } from 'vitest';
import { checkPhoto, parseVerdict, photoPrompt } from '../src/modules/photo/check';

describe('photo check', () => {
  it('parses a JSON verdict, even wrapped in text', () => {
    expect(parseVerdict('k', 'Sure: {"result":"pass","note":"A tanker sprays a road."}')).toEqual({ key: 'k', result: 'pass', note: 'A tanker sprays a road.' });
  });
  it('anything unexpected becomes unclear with the standard note', () => {
    expect(parseVerdict('k', 'no idea')).toEqual({ key: 'k', result: 'unclear', note: 'Photo could not be checked' });
    expect(parseVerdict('k', '{"result":"maybe"}').result).toBe('unclear');
  });
  it('never throws: with no key or bucket it returns unclear', async () => {
    const saved = { g: process.env.GOOGLE_API_KEY, m: process.env.GEMINI_API_KEY };
    delete process.env.GOOGLE_API_KEY; delete process.env.GEMINI_API_KEY;
    const r = await checkPhoto('photos/x.jpg', 'water_sprinkling', 'Anand Vihar', Buffer.from('x'));
    if (saved.g) process.env.GOOGLE_API_KEY = saved.g;
    if (saved.m) process.env.GEMINI_API_KEY = saved.m;
    expect(r).toEqual({ key: 'photos/x.jpg', result: 'unclear', note: 'Photo could not be checked' });
  });
  it('the prompt names the action, the area and what counts as visible work', () => {
    const p = photoPrompt('water_sprinkling', 'Mundka');
    expect(p).toContain('Water sprinkling at Mundka');
    expect(p).toContain('water visibly spraying');
  });
});
