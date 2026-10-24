import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isTester, planChange, stripeForm, verifyStripeSignature } from './billing';

const sign = (body: string, secret: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('billing', () => {
  it('accepts a correctly signed Stripe event and rejects others', () => {
    const body = '{"type":"x"}';
    expect(verifyStripeSignature(body, sign(body, 'whsec_a', 1000), 'whsec_a', 1010)).toBe(true);
    expect(verifyStripeSignature(body, sign(body, 'whsec_b', 1000), 'whsec_a', 1010)).toBe(false);
    expect(verifyStripeSignature(body + ' ', sign(body, 'whsec_a', 1000), 'whsec_a', 1010)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, 'whsec_a', 1000), 'whsec_a', 2000)).toBe(false);
    expect(verifyStripeSignature(body, undefined, 'whsec_a', 1010)).toBe(false);
    expect(verifyStripeSignature(body, 't=1000,v1=zz', 'whsec_a', 1010)).toBe(false);
  });

  it('turns on Plus when checkout completes', () => {
    const c = planChange({ type: 'checkout.session.completed', data: { object: { client_reference_id: 'u1', customer: 'cus_1', subscription: 'sub_1' } } }, 5);
    expect(c).toEqual({ kind: 'by-uid', uid: 'u1', plan: { active: true, customer: 'cus_1', subscription: 'sub_1', updatedAt: 5 } });
  });

  it('turns Plus off when the subscription ends or lapses', () => {
    expect(planChange({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled' } } }, 5)).toEqual({ kind: 'by-subscription', subscription: 'sub_1', active: false });
    expect(planChange({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'unpaid' } } }, 5)).toEqual({ kind: 'by-subscription', subscription: 'sub_1', active: false });
    expect(planChange({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active' } } }, 5)).toEqual({ kind: 'by-subscription', subscription: 'sub_1', active: true });
  });

  it('ignores events it does not use', () => {
    expect(planChange({ type: 'invoice.paid', data: { object: {} } }, 5)).toEqual({ kind: 'none' });
    expect(planChange(null, 5)).toEqual({ kind: 'none' });
    expect(planChange({ type: 'checkout.session.completed', data: { object: {} } }, 5)).toEqual({ kind: 'none' });
  });

  it('matches testers by email, ignoring case and spaces', () => {
    expect(isTester('A@x.com', 'b@x.com, a@x.com')).toBe(true);
    expect(isTester('c@x.com', 'b@x.com, a@x.com')).toBe(false);
    expect(isTester(undefined, 'a@x.com')).toBe(false);
    expect(isTester('a@x.com', '')).toBe(false);
  });

  it('form-encodes Stripe parameters', () => {
    expect(stripeForm({ 'line_items[0][price]': 'price_1', success_url: 'https://a/b?c=d' })).toBe('line_items%5B0%5D%5Bprice%5D=price_1&success_url=https%3A%2F%2Fa%2Fb%3Fc%3Dd');
  });
});
