/**
 * ComingSoonCard - Disabled game card for future games (presentation only)
 */

interface ComingSoonCardProps {
  icon: string;
  title: string;
  description: string;
}

export function ComingSoonCard({ icon, title, description }: ComingSoonCardProps) {
  return (
    <div className="game-card-disabled">
      <div className="coming-soon-badge">Coming Soon</div>
      <div className="game-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
