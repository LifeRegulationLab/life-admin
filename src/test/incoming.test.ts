import { describe, expect, it } from 'vitest';
import { INCOMING_TEXT_MAX, hasIncoming, incomingQuery, readIncoming, sourceName } from '../lib/logic/incoming';

describe('a link from another app', () => {
  it('starts a new thing with the words filled in', () => {
    const incoming = readIncoming('?kind=letter&title=Write%20to%20the%20clinic&text=Ask%20for%20the%20results%20in%20writing.&from=regulate');
    expect(incoming).toEqual({ kind: 'letter', title: 'Write to the clinic', text: 'Ask for the results in writing.', source: 'regulate' });
    expect(sourceName(incoming)).toBe('Regulate');
  });

  it('leaves the kind to the person when it is missing or unknown', () => {
    expect(readIncoming('?kind=parcel&text=Ring%20them').kind).toBeUndefined();
    expect(readIncoming('?text=Ring%20them').kind).toBeUndefined();
  });

  it('ignores a source it does not know and keeps the words short', () => {
    const incoming = readIncoming(new URLSearchParams({ from: 'elsewhere', title: '  Two\n lines  ', text: 'x'.repeat(INCOMING_TEXT_MAX + 50) }));
    expect(incoming.source).toBeUndefined();
    expect(incoming.title).toBe('Two lines');
    expect(incoming.text).toHaveLength(INCOMING_TEXT_MAX);
  });

  it('carries the words on to the next screen without the kind', () => {
    const incoming = readIncoming('?kind=call&title=Ring%20the%20surgery&from=regulate');
    expect(readIncoming(incomingQuery(incoming))).toEqual({ title: 'Ring the surgery', text: '', source: 'regulate' });
    expect(hasIncoming(readIncoming(''))).toBe(false);
    expect(incomingQuery(readIncoming(''))).toBe('');
  });
});
