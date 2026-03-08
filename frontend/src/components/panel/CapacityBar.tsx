interface CapacityBarProps {
  totalWorkdayHrs: number;
  maxHrs?: number;
}

function getFillColour(hrs: number): string {
  if (hrs > 9.0) return '#DC2626';
  if (hrs > 8.5) return '#F59E0B';
  if (hrs >= 6.0) return '#2E8B57';
  return '#D4760A';
}

export function CapacityBar({ totalWorkdayHrs, maxHrs = 9.0 }: CapacityBarProps) {
  const pct = Math.min((totalWorkdayHrs / maxHrs) * 100, 100);
  const colour = getFillColour(totalWorkdayHrs);

  return (
    <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E2E8F0' }}>
      <div
        className="h-2 rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: colour }}
      />
    </div>
  );
}
