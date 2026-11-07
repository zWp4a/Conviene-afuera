import { beforeEach, describe, expect, it } from 'vitest';
import { clientKey, rateLimit, resetRateLimit } from '@/lib/rate-limit';

beforeEach(resetRateLimit);

describe('rate limit', () => {
  it('permite hasta el límite y bloquea después', () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit('ip:1', opts).allowed).toBe(true);
    expect(rateLimit('ip:1', opts).allowed).toBe(true);
    const tercera = rateLimit('ip:1', opts);
    expect(tercera.allowed).toBe(true);
    expect(tercera.remaining).toBe(0);
    expect(rateLimit('ip:1', opts).allowed).toBe(false);
  });

  it('cuenta por clave, no global', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit('ip:1', opts).allowed).toBe(true);
    expect(rateLimit('ip:2', opts).allowed).toBe(true);
    expect(rateLimit('ip:1', opts).allowed).toBe(false);
  });

  it('informa cuándo se libera un slot', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    rateLimit('ip:1', opts);
    const r = rateLimit('ip:1', opts);
    expect(r.resetAt).toBeGreaterThan(Date.now());
    expect(r.limit).toBe(1);
  });

  it('saca la IP del header x-forwarded-for', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('ip:1.2.3.4');
    expect(clientKey(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('ip:9.9.9.9');
    expect(clientKey(new Headers())).toBe('ip:desconocida');
  });
});
