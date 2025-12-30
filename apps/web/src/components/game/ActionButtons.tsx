import { useState } from 'preact/hooks';
import type { ActionButtonsProps } from '@risejack/shared';

type ActionType = 'hit' | 'stand' | 'double' | 'surrender' | null;

export function ActionButtons({
  onHit,
  onStand,
  onDouble,
  onSurrender,
  canDouble,
  canSurrender,
  isLoading,
}: ActionButtonsProps) {
  const [pendingAction, setPendingAction] = useState<ActionType>(null);

  // Wrapper to track which action is pending
  const handleAction = async (action: ActionType, handler: () => void | Promise<unknown>) => {
    setPendingAction(action);
    try {
      await handler();
    } finally {
      setPendingAction(null);
    }
  };

  // Fixed width to prevent layout shift - same width for all buttons
  const baseClass = `
        min-w-24 px-6 py-3 rounded-lg font-bold text-lg 
        transition-all duration-200 
        active:scale-95 
        disabled:opacity-50 disabled:cursor-not-allowed
        relative overflow-hidden
    `;

  // Show spinner overlay only on the clicked button
  const ButtonContent = ({ label, action }: { label: string; action: ActionType }) => {
    const isPending = pendingAction === action && isLoading;
    return (
      <>
        {/* Text - stays visible but dimmed when loading */}
        <span className={isPending ? 'opacity-0' : 'opacity-100'}>{label}</span>
        {/* Spinner overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
      </>
    );
  };

  // Any action pending means disable all buttons
  const anyPending = isLoading || pendingAction !== null;

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={() => handleAction('hit', onHit)}
        disabled={anyPending}
        className={`${baseClass} bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20`}
      >
        <ButtonContent label="HIT" action="hit" />
      </button>

      <button
        onClick={() => handleAction('stand', onStand)}
        disabled={anyPending}
        className={`${baseClass} bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20`}
      >
        <ButtonContent label="STAND" action="stand" />
      </button>

      <button
        onClick={() => handleAction('double', onDouble)}
        disabled={anyPending || !canDouble}
        className={`${baseClass} bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 ${!canDouble && 'opacity-40'}`}
      >
        <ButtonContent label="DOUBLE" action="double" />
      </button>

      <button
        onClick={() => handleAction('surrender', onSurrender)}
        disabled={anyPending || !canSurrender}
        className={`${baseClass} bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 ${!canSurrender && 'opacity-40'}`}
      >
        <ButtonContent label="SURRENDER" action="surrender" />
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}
