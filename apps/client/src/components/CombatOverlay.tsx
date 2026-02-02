import type { CombatState, GameCommand } from '@verdantia/shared';
import { CommandType } from '@verdantia/shared';

interface CombatOverlayProps {
  combat: CombatState;
  sendCommand: (command: GameCommand) => void;
}

export function CombatOverlay({ combat, sendCommand }: CombatOverlayProps) {
  const hpPercent = combat.enemyMaxHp > 0 ? (combat.enemyHp / combat.enemyMaxHp) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-gray-900 border border-red-800 rounded-lg p-4 shadow-2xl min-w-80">
        {/* Enemy info */}
        <div className="text-center mb-3">
          <h3 className="text-red-400 font-bold">{combat.enemyName}</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-gray-500 text-xs">HP</span>
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs">
              {combat.enemyHp}/{combat.enemyMaxHp}
            </span>
          </div>
        </div>

        {/* Turn indicator */}
        <p className="text-center text-xs text-gray-500 mb-3">
          {combat.isPlayerTurn ? 'Your turn' : 'Enemy turn...'} (Round {combat.turnCount})
        </p>

        {/* Action buttons */}
        {combat.isPlayerTurn && (
          <div className="flex gap-2">
            <button
              onClick={() => sendCommand({ type: CommandType.ATTACK })}
              className="flex-1 py-2 px-3 bg-red-700 hover:bg-red-600 text-white rounded text-sm transition-colors"
            >
              Attack
            </button>
            <button
              onClick={() => sendCommand({ type: CommandType.DEFEND })}
              className="flex-1 py-2 px-3 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm transition-colors"
            >
              Defend
            </button>
            <button
              onClick={() => sendCommand({ type: CommandType.FLEE })}
              className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              Flee
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
