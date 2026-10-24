import { describe, expect, it } from 'vitest';
import { newItem } from '../lib/logic/items';
import type { Item } from '../lib/model/types';
import { LocalBackend, MemoryStorage } from '../lib/store/local';
import { NOW } from './fixtures';

describe('records on the device', () => {
  it('saves, updates and removes, telling the screen each time', async () => {
    const b = new LocalBackend('dealt-with:device', new MemoryStorage());
    const seen: Item[][] = [];
    b.listen<Item>('items', (items) => seen.push(items));
    const item = newItem('letter', { title: 'A' }, NOW);
    await b.save('items', item);
    await b.save('items', { ...item, title: 'B' });
    await b.remove('items', item.id);
    expect(seen.map((s) => s.map((i) => i.title))).toEqual([[], ['A'], ['B'], []]);
  });
});
