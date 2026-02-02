import { useState } from 'react';
import { useGameStore } from '../stores/game-store';

export function SkillsPanel() {
  const skills = useGameStore((s) => s.skills);
  const skillDefinitions = useGameStore((s) => s.skillDefinitions);
  const currentRoomResources = useGameStore((s) => s.currentRoomResources);
  const [showDetails, setShowDetails] = useState(false);

  const skillEntries = Object.values(skillDefinitions);

  if (skillEntries.length === 0) return null;

  return (
    <>
      <div className="p-3 space-y-4">
        {/* Skills */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Skills</h3>
          <div className="space-y-2">
            {skillEntries.map((def) => {
              const playerSkill = skills.find((s) => s.skillId === def.id);
              const level = playerSkill?.level ?? 1;
              const xp = playerSkill?.xp ?? 0;
              const prevXp = level > 1 ? def.xpPerLevel[level - 1] ?? 0 : 0;
              const nextXp = level < def.maxLevel ? def.xpPerLevel[level] ?? 0 : 0;
              const xpIntoLevel = xp - prevXp;
              const xpNeeded = nextXp - prevXp;
              const progress = level >= def.maxLevel ? 100 : xpNeeded > 0 ? Math.floor((xpIntoLevel / xpNeeded) * 100) : 0;

              return (
                <div key={def.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{def.name}</span>
                    <span className="text-verdant-400 font-bold text-xs">{level}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-verdant-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowDetails(true)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Details
          </button>
        </div>

        {/* Resources Here */}
        {currentRoomResources.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Resources Here</h3>
            <ul className="space-y-1">
              {currentRoomResources.map((node) => (
                <li
                  key={node.nodeId}
                  className={`text-sm ${
                    node.available
                      ? 'text-verdant-300'
                      : 'text-gray-600 line-through'
                  }`}
                >
                  {node.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-verdant-400 font-bold tracking-wider uppercase">Skills</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              {skillEntries.map((def) => {
                const playerSkill = skills.find((s) => s.skillId === def.id);
                const level = playerSkill?.level ?? 1;
                const xp = playerSkill?.xp ?? 0;
                const prevXp = level > 1 ? def.xpPerLevel[level - 1] ?? 0 : 0;
                const nextXp = level < def.maxLevel ? def.xpPerLevel[level] ?? 0 : 0;
                const xpIntoLevel = xp - prevXp;
                const xpNeeded = nextXp - prevXp;
                const progress = level >= def.maxLevel ? 100 : xpNeeded > 0 ? Math.floor((xpIntoLevel / xpNeeded) * 100) : 0;

                return (
                  <div key={def.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-gray-200 font-bold">{def.name}</h3>
                      <span className="text-verdant-400 font-bold">
                        Level {level}/{def.maxLevel}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-2">{def.description}</p>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                      <div
                        className="bg-verdant-600 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs">
                      {level >= def.maxLevel
                        ? 'MAX LEVEL'
                        : `${xpIntoLevel} / ${xpNeeded} XP to level ${level + 1} (Total: ${xp} XP)`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
