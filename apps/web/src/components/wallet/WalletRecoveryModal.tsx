/**
 * Wallet Recovery Modal
 * Shows when wallet connection repeatedly fails due to corrupted data
 */

import { useState } from 'preact/hooks';
import { clearRiseWalletData } from '@/lib/walletRecovery';

interface WalletRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoveryComplete: () => void;
}

export function WalletRecoveryModal({
  isOpen,
  onClose,
  onRecoveryComplete,
}: WalletRecoveryModalProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleAutoFix = async () => {
    setIsRecovering(true);
    setRecoveryStatus('idle');

    try {
      const success = await clearRiseWalletData();

      if (success) {
        setRecoveryStatus('success');
        // Wait a moment to show success, then trigger reconnect
        setTimeout(() => {
          onRecoveryComplete();
        }, 1000);
      } else {
        setRecoveryStatus('error');
      }
    } catch {
      setRecoveryStatus('error');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-xl font-bold text-white">Connection Issue Detected</h2>
        </div>

        {/* Content */}
        {recoveryStatus === 'idle' && (
          <>
            <p className="text-gray-300 mb-4">
              Your wallet data may need refreshing. This happens occasionally and can be fixed in
              one click.
            </p>

            <p className="text-gray-400 text-sm mb-6">
              This will clear your local wallet cache. You'll need to reconnect using your passkey.
            </p>
          </>
        )}

        {recoveryStatus === 'success' && (
          <div className="text-center py-4">
            <span className="text-4xl mb-2 block">✅</span>
            <p className="text-green-400 font-medium">Fixed! Reconnecting...</p>
          </div>
        )}

        {recoveryStatus === 'error' && (
          <div className="mb-4">
            <p className="text-red-400 mb-4">
              Auto-fix didn't work. Try clearing your browser's site data manually:
            </p>
            <ol className="text-gray-400 text-sm list-decimal list-inside space-y-1">
              <li>Open DevTools (F12)</li>
              <li>Go to Application → Storage</li>
              <li>Click "Clear site data"</li>
              <li>Refresh and try again</li>
            </ol>
          </div>
        )}

        {/* Actions */}
        {recoveryStatus !== 'success' && (
          <div className="flex gap-3">
            <button
              onClick={handleAutoFix}
              disabled={isRecovering}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isRecovering ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Fixing...
                </>
              ) : (
                <>
                  <span>🔧</span>
                  {recoveryStatus === 'error' ? 'Try Again' : 'Fix & Reconnect'}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
