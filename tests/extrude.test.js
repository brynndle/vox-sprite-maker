import { describe, test, expect } from 'vitest';

function zLayers(depth) {
  return Array.from({ length: depth }, (_, i) => Math.floor(depth / 2) - i);
}

describe('zLayers — z-centering formula', () => {
  test('depth 1 → [0]',               () => expect(zLayers(1)).toEqual([0]));
  test('depth 2 → [1, 0]',            () => expect(zLayers(2)).toEqual([1, 0]));
  test('depth 3 → [1, 0, -1]',        () => expect(zLayers(3)).toEqual([1, 0, -1]));
  test('depth 4 → [2, 1, 0, -1]',     () => expect(zLayers(4)).toEqual([2, 1, 0, -1]));
  test('depth 5 → [2, 1, 0, -1, -2]', () => expect(zLayers(5)).toEqual([2, 1, 0, -1, -2]));
  test('z=0 (skeleton plane) always included', () => {
    for (let d = 1; d <= 8; d++) expect(zLayers(d)).toContain(0);
  });
});
