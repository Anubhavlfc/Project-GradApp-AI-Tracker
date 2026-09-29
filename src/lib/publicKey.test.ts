import { assertPublicKey } from './publicKey';

function fakeJwt(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('assertPublicKey', () => {
  it('accepts an anon JWT', () => {
    expect(() => assertPublicKey(fakeJwt({ role: 'anon' }))).not.toThrow();
  });

  it('accepts a publishable key', () => {
    expect(() => assertPublicKey('sb_publishable_abc123')).not.toThrow();
  });

  it('accepts values that are not JWTs at all', () => {
    expect(() => assertPublicKey('not-a-jwt')).not.toThrow();
    expect(() => assertPublicKey('a.b.c')).not.toThrow();
  });

  it('rejects a service_role JWT', () => {
    expect(() => assertPublicKey(fakeJwt({ role: 'service_role' }))).toThrow(/secret/);
  });

  it('rejects a secret key', () => {
    expect(() => assertPublicKey('sb_secret_abc123')).toThrow(/secret/);
  });

  it('never repeats the key in the error message', () => {
    const key = fakeJwt({ role: 'service_role' });
    expect(() => assertPublicKey(key)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(key) }),
    );
  });
});
