import { heatStyle } from '../../lib/tone';

const STEPS = [1, 0.45, 0.12];

export default function HeatLegend({ className }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-center gap-1.5 text-[10.5px] text-text-muted">
        <span>Tap</span>
        {STEPS.map((step) => (
          <span key={`n${step}`} className="h-2.5 w-2.5 rounded-[2px] border" style={heatStyle(-step, 1)} />
        ))}
        <span className="h-2.5 w-2.5 rounded-[2px] border border-hairline bg-sunken" />
        {[...STEPS].reverse().map((step) => (
          <span key={`p${step}`} className="h-2.5 w-2.5 rounded-[2px] border" style={heatStyle(step, 1)} />
        ))}
        <span>Gevinst</span>
      </div>
    </div>
  );
}
