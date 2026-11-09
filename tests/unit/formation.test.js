import { describe, expect, it } from 'vitest';
import { isLegalFormation } from '../../functions/api/standings.js';

function players(counts) {
  return Object.entries(counts).flatMap(([position, count]) => (
    Array.from({ length: count }, () => ({ position: Number(position) }))
  ));
}

describe('isLegalFormation', () => {
  it.each([
    [{ 1: 1, 2: 3, 3: 5, 4: 2 }, 'minimum defenders and maximum midfielders'],
    [{ 1: 1, 2: 5, 3: 4, 4: 1 }, 'maximum defenders'],
    [{ 1: 1, 2: 5, 3: 2, 4: 3 }, 'minimum midfielders and maximum forwards'],
    [{ 1: 1, 2: 3, 3: 4, 4: 3 }, 'maximum forwards'],
    [{ 1: 1, 2: 4, 3: 5, 4: 1 }, 'minimum forwards and maximum midfielders']
  ])('accepts %j (%s)', (counts) => {
    const squad = players(counts);
    expect(squad).toHaveLength(11);
    expect(isLegalFormation(squad)).toBe(true);
  });

  it.each([
    [{ 1: 1, 2: 2, 3: 5, 4: 3 }, 'fewer than 3 defenders'],
    [{ 1: 1, 2: 6, 3: 3, 4: 1 }, 'more than 5 defenders'],
    [{ 1: 1, 2: 5, 3: 1, 4: 4 }, 'fewer than 2 midfielders'],
    [{ 1: 1, 2: 3, 3: 6, 4: 1 }, 'more than 5 midfielders'],
    [{ 1: 1, 2: 5, 3: 5, 4: 0 }, 'no forward'],
    [{ 1: 1, 2: 3, 3: 3, 4: 4 }, 'more than 3 forwards'],
    [{ 1: 0, 2: 5, 3: 4, 4: 2 }, 'no goalkeeper'],
    [{ 1: 2, 2: 3, 3: 4, 4: 2 }, 'two goalkeepers']
  ])('rejects %j (%s)', (counts) => {
    const squad = players(counts);
    expect(squad).toHaveLength(11);
    expect(isLegalFormation(squad)).toBe(false);
  });

  it('rejects squads that are not exactly 11 players', () => {
    expect(isLegalFormation(players({ 1: 1, 2: 4, 3: 4, 4: 2 }))).toBe(true);
    expect(isLegalFormation(players({ 1: 1, 2: 3, 3: 4, 4: 1 }))).toBe(false);
    expect(isLegalFormation(players({ 1: 1, 2: 4, 3: 5, 4: 2 }))).toBe(false);
    expect(isLegalFormation([])).toBe(false);
    expect(isLegalFormation(null)).toBe(false);
  });

  it('rejects an unknown position even when eleven players are present', () => {
    const squad = players({ 1: 1, 2: 4, 3: 4, 4: 2 });
    squad[squad.length - 1] = { position: 5 };
    expect(squad).toHaveLength(11);
    expect(isLegalFormation(squad)).toBe(false);
  });
});
