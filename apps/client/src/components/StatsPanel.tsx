import { useGameStore } from '../stores/game-store';
import { GamePhase, getXpForLevel, getXpProgress } from '@verdantia/shared';

export function StatsPanel() {
  const stats = useGameStore((s) => s.stats);
  const playerName = useGameStore((s) => s.playerName);
  const gold = useGameStore((s) => s.gold);
  const phase = useGameStore((s) => s.phase);

  if (phase === GamePhase.TITLE) return null;

  const hpPercent = stats.maxHp > 0 ? (stats.hp / stats.maxHp) * 100 : 0;
  const hpColor = hpPercent > 60 ? 'bg-verdant-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500';

  const xpPercent = getXpProgress(stats.xp, stats.level);
  const currentLevelXp = getXpForLevel(stats.level);
  const nextLevelXp = getXpForLevel(stats.level + 1);
  const xpIntoLevel = stats.xp - currentLevelXp;
  const xpNeededForLevel = nextLevelXp - currentLevelXp;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-verdant-300 font-medium">{playerName}</span>
      <span className="text-gray-400">Lv.{stats.level}</span>

      {/* HP bar */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">HP</span>
        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${hpColor} transition-all duration-300`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <span className="text-gray-400 text-xs">
          {stats.hp}/{stats.maxHp}
        </span>
      </div>

      {/* XP bar */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-xs">XP</span>
        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <span className="text-gray-400 text-xs">
          {xpIntoLevel}/{xpNeededForLevel}
        </span>
      </div>

      <span className="text-yellow-400 text-xs">{gold}g</span>
    </div>
  );
}
