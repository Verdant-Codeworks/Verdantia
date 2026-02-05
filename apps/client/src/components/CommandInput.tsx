import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../stores/game-store';

interface CommandInputProps {
  onSubmit: (text: string) => boolean;
  getHistory: (direction: 'up' | 'down') => string | null;
  disabled?: boolean;
}

export function CommandInput({ onSubmit, getHistory, disabled }: CommandInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = useGameStore((s) => s.isProcessingCommand);
  const addCommandEcho = useGameStore((s) => s.addCommandEcho);

  const isDisabled = disabled || isProcessing;

  useEffect(() => {
    if (!isDisabled) {
      inputRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing || disabled) return;
    const commandText = input.trim();
    const success = onSubmit(input);
    if (success) {
      addCommandEcho(commandText);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = getHistory('up');
      if (prev !== null) setInput(prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = getHistory('down');
      if (next !== null) setInput(next);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-gray-800 p-3">
      <div className="flex items-center gap-2">
        <span className="text-verdant-500 font-bold">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Game over...' : 'Enter a command...'}
          disabled={isDisabled}
          className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 focus:outline-none"
          autoFocus
        />
        {isProcessing && (
          <span className="text-gray-500 text-xs animate-pulse">...</span>
        )}
      </div>
    </div>
  );
}
