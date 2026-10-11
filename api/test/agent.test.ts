import { describe, expect, it } from 'vitest';
import { readableNames } from '../src/modules/agent/run';

describe('agent answer clean-up', () => {
  it('replaces cause and action code names, in Hindi for Hindi answers', () => {
    expect(readableNames('The likely cause is regional_smoke; issue a public_advisory.')).toBe('The likely cause is smoke from farm fires; issue a public advisory.');
    expect(readableNames('संभावित कारण regional_smoke है')).toBe('संभावित कारण पराली के धुएँ है');
  });
});
