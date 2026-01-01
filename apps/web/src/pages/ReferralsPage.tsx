/**
 * Referrals Page
 *
 * Full-page referrals dashboard
 */

import { ReferralsDashboard } from '@/components/game/ReferralsDashboard';

export function ReferralsPage() {
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🎁 Referral Program</h1>
          <p className="text-gray-400">
            Invite friends and earn passive income from their gameplay
          </p>
        </div>

        {/* Referrals Dashboard */}
        <ReferralsDashboard />

        {/* FAQ Section */}
        <div className="mt-8 bg-slate-800/30 rounded-xl p-6 border border-slate-700/30">
          <h3 className="text-lg font-bold text-white mb-4">FAQ</h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-purple-400 font-semibold">How much do I earn?</p>
              <p className="text-gray-400">
                You earn 10% of the house edge from every game your referrals play. The house edge
                is approximately 1.5% of each bet.
              </p>
            </div>
            <div>
              <p className="text-purple-400 font-semibold">How do I get paid?</p>
              <p className="text-gray-400">
                Earnings accumulate in your account and are distributed monthly as CHIP tokens via
                airdrop. No action required - tokens appear in your wallet.
              </p>
            </div>
            <div>
              <p className="text-purple-400 font-semibold">Is there a limit?</p>
              <p className="text-gray-400">
                No limit! Invite as many friends as you want. Earnings are lifetime - you'll always
                earn from your referrals' gameplay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
