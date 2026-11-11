import type { Collection, DocName } from '../store/backend';
import type { Remote, RemoteRow } from '../store/synced';

/**
 * The few calls the synced store makes to the shared Life Regulation Lab server, over its plain
 * web interface. Everything is in the "dealt_with" schema, and the server only ever answers with
 * the signed-in person's own rows.
 *
 * The address and public key are client values, not secrets; `token` gives the person's sign-in
 * for each call. Sign-in itself is wired up separately.
 */

export const SCHEMA = 'dealt_with';

export interface RemoteConfig {
  url: string;
  key: string;
  token: () => Promise<string>;
  fetch?: typeof fetch;
}

export class RestRemote implements Remote {
  private readonly send: typeof fetch;

  constructor(private readonly config: RemoteConfig) {
    this.send = config.fetch ?? ((input, init) => fetch(input, init));
  }

  private async call(method: string, path: string, body?: unknown, prefer?: string): Promise<Response> {
    const response = await this.send(`${this.config.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: this.config.key,
        authorization: `Bearer ${await this.config.token()}`,
        // Reads name the schema one way and writes the other.
        'accept-profile': SCHEMA,
        'content-profile': SCHEMA,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(prefer === undefined ? {} : { prefer }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`The server answered ${response.status}.`);
    return response;
  }

  async list(collection: Collection): Promise<RemoteRow[]> {
    const response = await this.call('GET', `records?select=id,data&collection=eq.${collection}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('The server did not answer with a list.');
    return rows.flatMap((row: unknown) => {
      if (typeof row !== 'object' || row === null) return [];
      const id: unknown = Reflect.get(row, 'id');
      return typeof id === 'string' ? [{ id, data: Reflect.get(row, 'data') as unknown }] : [];
    });
  }

  async put(collection: Collection, id: string, data: unknown): Promise<void> {
    await this.call(
      'POST',
      'records?on_conflict=user_id,collection,id',
      { collection, id, data, updated_at: new Date().toISOString() },
      'resolution=merge-duplicates,return=minimal',
    );
  }

  async remove(collection: Collection, id: string): Promise<void> {
    await this.call('DELETE', `records?collection=eq.${collection}&id=eq.${encodeURIComponent(id)}`);
  }

  async getDoc(name: DocName): Promise<unknown> {
    const response = await this.call('GET', `docs?select=data&name=eq.${name}`);
    const rows: unknown = await response.json();
    const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
    return typeof first === 'object' && first !== null ? (Reflect.get(first, 'data') as unknown) : undefined;
  }

  async putDoc(name: DocName, data: unknown): Promise<void> {
    await this.call(
      'POST',
      'docs?on_conflict=user_id,name',
      { name, data, updated_at: new Date().toISOString() },
      'resolution=merge-duplicates,return=minimal',
    );
  }
}
