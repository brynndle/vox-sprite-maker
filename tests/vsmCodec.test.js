import { describe, it, expect } from 'vitest';
import { encode, decode, DEFAULTS } from '../src/persistence/vsmCodec.js';

describe('DEFAULTS', () => {
  it('has version 1', () => {
    expect(DEFAULTS.version).toBe(1);
  });
  it('has all bodyShape keys', () => {
    const keys = ['hW','hH','tW','tH','aW','aL','lW','lL','fS'];
    keys.forEach(k => expect(DEFAULTS.bodyShape).toHaveProperty(k, 1));
  });
});

describe('encode', () => {
  it('returns valid JSON string', () => {
    const json = encode(DEFAULTS);
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });
  it('includes version field', () => {
    const json = encode({ ...DEFAULTS, version: 1 });
    expect(JSON.parse(json).version).toBe(1);
  });
});

describe('decode', () => {
  it('round-trips a complete object', () => {
    const data = {
      ...DEFAULTS,
      colors: { skin: '#e8c49a', hairCol: '#2c1810', featCol: '#1a1a1a', col: '#4a90d9' },
    };
    const decoded = decode(encode(data));
    expect(decoded.colors.skin).toBe('#e8c49a');
    expect(decoded.colors.hairCol).toBe('#2c1810');
  });
  it('fills missing colors with DEFAULTS', () => {
    const decoded = decode(JSON.stringify({ version: 1 }));
    expect(decoded.colors.skin).toBe(DEFAULTS.colors.skin);
    expect(decoded.colors.hairCol).toBe(DEFAULTS.colors.hairCol);
  });
  it('fills missing bodyShape with DEFAULTS', () => {
    const decoded = decode(JSON.stringify({ version: 1 }));
    expect(decoded.bodyShape).toEqual(DEFAULTS.bodyShape);
  });
  it('fills missing face with DEFAULTS', () => {
    const decoded = decode(JSON.stringify({ version: 1 }));
    expect(decoded.face).toEqual(DEFAULTS.face);
  });
  it('defaults equipped/savedParts/customWardrobe to empty objects', () => {
    const decoded = decode(JSON.stringify({ version: 1 }));
    expect(decoded.equipped).toEqual({});
    expect(decoded.savedParts).toEqual({});
    expect(decoded.customWardrobe).toEqual({});
  });
  it('throws on non-JSON input', () => {
    expect(() => decode('not json')).toThrow();
  });
  it('throws when version is missing', () => {
    expect(() => decode(JSON.stringify({ colors: {} }))).toThrow('Invalid .vsm');
  });
  it('partial bodyShape is merged with DEFAULTS', () => {
    const decoded = decode(JSON.stringify({ version: 1, bodyShape: { hW: 1.5 } }));
    expect(decoded.bodyShape.hW).toBe(1.5);
    expect(decoded.bodyShape.hH).toBe(1);  // from DEFAULTS
  });
});
