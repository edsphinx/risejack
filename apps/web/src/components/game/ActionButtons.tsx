import type { ActionButtonsProps } from '@risejack/shared';

export function ActionButtons({
    onHit,
    onStand,
    onDouble,
    onSurrender,
    canDouble,
    canSurrender,
    isLoading,
}: ActionButtonsProps) {
    const baseClass = "px-6 py-3 rounded-lg font-bold text-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={onHit} disabled={isLoading} className={`${baseClass} bg-green-600 hover:bg-green-500 text-white`}>
                {isLoading ? <Spinner /> : 'HIT'}
            </button>
            <button onClick={onStand} disabled={isLoading} className={`${baseClass} bg-amber-600 hover:bg-amber-500 text-white`}>
                {isLoading ? <Spinner /> : 'STAND'}
            </button>
            <button onClick={onDouble} disabled={isLoading || !canDouble} className={`${baseClass} bg-blue-600 hover:bg-blue-500 text-white`}>
                {isLoading ? <Spinner /> : 'DOUBLE'}
            </button>
            <button onClick={onSurrender} disabled={isLoading || !canSurrender} className={`${baseClass} bg-red-600 hover:bg-red-500 text-white`}>
                {isLoading ? <Spinner /> : 'SURRENDER'}
            </button>
        </div>
    );
}

function Spinner() {
    return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
