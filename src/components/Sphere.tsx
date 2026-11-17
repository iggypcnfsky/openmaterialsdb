type Props = {
  hex?: string | null;
  metalness?: number | null;
  roughness?: number | null;
  transmission?: number | null;
  size?: number;
  label?: string;
};

function mix(hex: string, target: [number, number, number], t: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `rgb(${c.map((v, i) => Math.round(v + (target[i] - v) * t)).join(',')})`;
}

/** Lightweight CSS "rendered sphere" preview driven by the sourced OpenPBR values. Not a physically based render. */
export function Sphere({ hex, metalness, roughness, transmission, size = 120, label }: Props) {
  if (!hex) {
    return (
      <div className="sphere sphere--empty" style={{ width: size, height: size }} aria-label="No sourced appearance data" title="No sourced appearance data">
        <span>no PBR data</span>
      </div>
    );
  }
  const r = Math.min(Math.max(roughness ?? 0.4, 0), 1);
  const metal = (metalness ?? 0) >= 0.5;
  const clear = (transmission ?? 0) >= 0.5;
  const hl = metal ? mix(hex, [255, 255, 255], 0.75) : 'rgba(255,255,255,0.95)';
  const spot = 6 + r * 30;
  const shade = mix(hex, [0, 0, 0], metal ? 0.65 : 0.5);
  const background = clear
    ? `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0 ${spot * 0.6}%, transparent ${spot + 6}%),
       radial-gradient(circle at 65% 75%, rgba(255,255,255,0.55), transparent 40%),
       radial-gradient(circle at 50% 50%, rgba(200,210,215,0.10) 55%, rgba(120,130,140,0.45) 72%)`
    : `radial-gradient(circle at 32% 28%, ${hl} 0 ${spot * 0.5}%, transparent ${spot + 10}%),
       radial-gradient(circle at 40% 35%, ${hex} 20%, ${shade} 78%, ${metal ? mix(hex, [255, 255, 255], 0.3) : shade} 100%)`;
  return (
    <div
      className={`sphere${clear ? ' sphere--clear' : ''}`}
      style={{ width: size, height: size, background }}
      role="img"
      aria-label={label ? `${label} preview` : 'material preview'}
    />
  );
}
