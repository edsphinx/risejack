/**
 * LiveStats - FOMO stats bar (presentation only)
 */

interface LiveStatsProps {
  playersOnline: number;
  totalPot: number;
  biggestWin: number;
}

export function LiveStats({ playersOnline, totalPot, biggestWin }: LiveStatsProps) {
  return (
    <section className="stats-bar">
      <StatItem icon="🎮" value={String(playersOnline)} label="Players Online" />
      <div className="stat-divider" />
      <StatItem icon="💰" value={`${totalPot} ETH`} label="Total Pot" />
      <div className="stat-divider" />
      <StatItem icon="🏆" value={`${biggestWin} ETH`} label="Biggest Win Today" />
    </section>
  );
}

// Internal sub-component
interface StatItemProps {
  icon: string;
  value: string;
  label: string;
}

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <div className="stat-item">
      <span className="stat-icon">{icon}</span>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}
