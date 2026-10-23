import type { Career, Club, StaffRole } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { generateStaff } from '../universe/world';

/** Cria profissionais reais para o clube controlado a partir do nível abstrato da comissão. */
export function seedUserStaff(c: Career, club: Club): void {
  const rng = new Rng(seedFrom(c.id, 'staff', club.id));
  const plan: [StaffRole, number][] = [['coach', 2], ['youthCoach', 1], ['fitness', 1], ['gkCoach', 1], ['analyst', 1], ['scout', 2], ['medical', 1]];
  for (const [role, n] of plan) {
    for (let i = 0; i < n; i++) {
      const s = generateStaff(c, rng, role, clamp(club.staffLevel + rng.range(-3, 2), 1, 20), club.id, c.season);
      club.staffIds.push(s.id);
    }
  }
}
