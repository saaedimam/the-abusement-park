import { describe, expect, it } from 'vitest';
import {
  archiveIdentity,
  chipBadge,
  formatHitScore,
  leagueOwnership,
  rankMovement,
  rivalryRecord
} from '../../public/scripts/league.js';

describe('live league derivations', () => {
  it('names the four chips and a position change', () => {
    expect(chipBadge('wildcard')).toEqual({ code: 'WC', label: 'Wildcard' });
    expect(chipBadge('bboost').code).toBe('BB');
    expect(chipBadge('freehit').code).toBe('FH');
    expect(chipBadge('3xc')).toEqual({ code: 'TC', label: 'Triple Captain' });
    expect(chipBadge('')).toBeNull();
    expect(rankMovement(1, 4)).toEqual({ direction: 'up', places: 3 });
    expect(rankMovement(5, 2)).toEqual({ direction: 'down', places: 3 });
    expect(rankMovement(3, 3)).toEqual({ direction: 'flat', places: 0 });
    expect(rankMovement(1, 0)).toBeNull();
    expect(formatHitScore(77, 4, 73)).toBe('77 (−4) = 73');
    expect(formatHitScore(50, 0, 50)).toBeNull();
  });

  it('counts captains, benches, and single-manager picks inside the league', () => {
    const ownership = leagueOwnership([
      {
        entry: 1,
        playerName: 'Alex',
        picksKnown: true,
        squad: [
          { id: 10, name: 'Shared', multiplier: 1, slot: 1, captain: false, viceCaptain: true },
          { id: 11, name: 'Saka', multiplier: 2, slot: 3, captain: true, viceCaptain: false }
        ]
      },
      {
        entry: 2,
        playerName: 'Blair',
        picksKnown: true,
        squad: [
          { id: 10, name: 'Shared', multiplier: 0, slot: 12, captain: false, viceCaptain: false },
          { id: 12, name: 'Haaland', multiplier: 2, slot: 9, captain: true, viceCaptain: false }
        ]
      },
      { entry: 3, playerName: 'Casey', picksKnown: false, squad: [] }
    ]);

    expect(ownership.managersCounted).toBe(2);
    expect(ownership.squadsUnavailable).toBe(1);
    expect(ownership.captaincy.map(player => player.name)).toEqual(['Haaland', 'Saka']);
    expect(ownership.differentials.map(player => player.name)).toEqual(['Haaland', 'Saka']);
    const shared = ownership.players.find(player => player.name === 'Shared');
    expect(shared).toMatchObject({ starting: 1, benched: 1, differential: false });
    expect(shared.vices).toHaveLength(1);
  });

  it('uses reviewed archive names for titles and runner-up meetings only', () => {
    expect(archiveIdentity(570338)).toBe('Mac Alvi');
    expect(archiveIdentity(523129)).toBe('Irfan Ahmed');
    expect(archiveIdentity(999)).toBeNull();

    const record = rivalryRecord(570338, 523129);
    expect(record.available).toBe(true);
    expect(record.leftTitles).toBe(5);
    expect(record.rightTitles).toBe(1);
    expect(record.leftTitlesOverRight).toBe(1);
    expect(record.rightTitlesOverLeft).toBe(0);
    expect(record.meetings).toEqual([{ year: '2022/23', winner: 'Mac Alvi', runnerUp: 'Irfan Ahmed' }]);
    expect(record.note).toContain('not gameweek head-to-head');

    expect(rivalryRecord(101, 202).available).toBe(false);
  });
});
