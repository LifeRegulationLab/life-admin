import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Dealt With Plus, paid through Stripe. Plain functions so they can be tested without Firebase
 * or Stripe. A person's plan lives in plans/{uid}, which only the server writes.
 */

export interface Plan {
  active: boolean;
  customer?: string;
  subscription?: string;
  updatedAt: number;
}

/** Checks the Stripe-Signature header: t=<time>,v1=<hmac of "t.body">. Rejects anything over five minutes old. */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, nowSeconds: number): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as Record<string, string | undefined>;
  const t = Number(parts['t']);
  const sigs = header
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!Number.isFinite(t) || sigs.length === 0 || Math.abs(nowSeconds - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export type PlanChange =
  | { kind: 'by-uid'; uid: string; plan: Plan }
  | { kind: 'by-subscription'; subscription: string; active: boolean }
  | { kind: 'none' };

/** Turns a Stripe event into the change it makes to a plan. */
export function planChange(event: unknown, now: number): PlanChange {
  if (typeof event !== 'object' || event === null) return { kind: 'none' };
  const e = event as { type?: string; data?: { object?: Record<string, unknown> } };
  const o = e.data?.object ?? {};
  if (e.type === 'checkout.session.completed') {
    const uid = typeof o['client_reference_id'] === 'string' ? o['client_reference_id'] : '';
    if (!uid) return { kind: 'none' };
    return {
      kind: 'by-uid',
      uid,
      plan: {
        active: true,
        ...(typeof o['customer'] === 'string' ? { customer: o['customer'] } : {}),
        ...(typeof o['subscription'] === 'string' ? { subscription: o['subscription'] } : {}),
        updatedAt: now,
      },
    };
  }
  if (e.type === 'customer.subscription.updated' || e.type === 'customer.subscription.deleted') {
    const id = typeof o['id'] === 'string' ? o['id'] : '';
    if (!id) return { kind: 'none' };
    const status = typeof o['status'] === 'string' ? o['status'] : '';
    return { kind: 'by-subscription', subscription: id, active: e.type === 'customer.subscription.updated' && ['active', 'trialing', 'past_due'].includes(status) };
  }
  return { kind: 'none' };
}

/** Testers listed by email always have Plus, so the app can be tried before it is on sale. */
export function isTester(email: string | undefined, testers: string): boolean {
  if (!email) return false;
  return testers
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/** Form-encodes nested Stripe parameters, such as line_items[0][price]. */
export function stripeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
