/* Fixed celestial backdrop. Single SVG instance behind every page.
   Stars + faint constellation lines + slow rotation pan.
   Pure CSS animation; no JS, no layout shift. */

const STARS_BRIGHT: Array<[number, number, number]> = [
  [12, 18, 1.4], [22, 32, 0.9], [38, 12, 1.1], [55, 24, 1.6], [70, 40, 1.0],
  [82, 18, 1.2], [88, 56, 0.8], [76, 70, 1.3], [60, 78, 0.9], [44, 64, 1.5],
  [28, 72, 1.0], [16, 50, 1.1], [50, 50, 1.8], [34, 44, 1.0], [66, 56, 1.2],
];

const STARS_DIM: Array<[number, number, number]> = [
  [8, 8, 0.4], [18, 22, 0.5], [26, 14, 0.4], [42, 28, 0.5], [58, 8, 0.4],
  [72, 14, 0.5], [86, 32, 0.4], [94, 48, 0.5], [80, 86, 0.4], [62, 92, 0.5],
  [48, 88, 0.5], [30, 84, 0.4], [12, 78, 0.5], [4, 38, 0.4], [38, 56, 0.5],
  [54, 38, 0.4], [70, 28, 0.4], [22, 56, 0.5], [78, 50, 0.4], [40, 76, 0.5],
];

// A handful of constellation lines (decorative — not real stars).
const LINES: Array<Array<[number, number]>> = [
  [[12, 18], [22, 32], [38, 12], [55, 24]],
  [[60, 78], [44, 64], [28, 72]],
  [[70, 40], [82, 18], [88, 56]],
];

export function CelestialBackground() {
  return (
    <div className="celestial" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <g className="celestial-pan">
          {LINES.map((pts, i) => (
            <polyline
              key={`line-${i}`}
              className="constellation-line"
              points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
            />
          ))}
          {STARS_DIM.map(([x, y, r], i) => (
            <circle key={`d-${i}`} className="star-dim" cx={x} cy={y} r={r * 0.18} />
          ))}
          {STARS_BRIGHT.map(([x, y, r], i) => (
            <circle key={`b-${i}`} className="star" cx={x} cy={y} r={r * 0.22} />
          ))}
        </g>
      </svg>
    </div>
  );
}
