import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/game-store';
import type { NarrativeMessage } from '@verdantia/shared';

const messageColors: Record<NarrativeMessage['type'], string> = {
  narrative: 'text-gray-200',
  combat: 'text-red-300',
  system: 'text-verdant-400',
  error: 'text-red-500',
  loot: 'text-yellow-300',
  levelup: 'text-purple-300',
  skill: 'text-cyan-300',
  command: 'text-gray-400 italic',
};

export function NarrativeOutput() {
  const messages = useGameStore((s) => s.messageHistory);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((msg) => (
        <div key={msg.id} className={messageColors[msg.type] || 'text-gray-200'}>
          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
