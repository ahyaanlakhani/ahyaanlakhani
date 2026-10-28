// Builds assets/skyline.svg: the year of contributions as an isometric skyline,
// animated with SVG's own <animate> tags so it plays inside a README image.
// Usage: GITHUB_TOKEN=... node scripts/skyline.mjs <login>
import { writeFileSync, mkdirSync } from "node:fs";

const login = process.argv[2] || process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!login || !token) {
  console.error("Need a login argument and GITHUB_TOKEN (or GH_TOKEN).");
  process.exit(1);
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: QUERY, variables: { login } }),
});
const json = await res.json();
if (json.errors || !json.data?.user) {
  console.error(JSON.stringify(json.errors ?? json));
  process.exit(1);
}
const calendar = json.data.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap((w) => w.contributionDays);

// GitHub's own five levels, lightest to darkest. Level 0 is empty.
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const RAMP = ["#2a2f36", "#0e4429", "#006d32", "#26a641", "#39d353"];
const FG = "#F5F5F0";
const MUTED = "#8b949e";
const BG = "#0A0A0A";

const W = 1100, H = 340;
const n = days.length;
const startDow = new Date(days[0].date + "T00:00:00Z").getUTCDay();
const cols = Math.ceil((n + startDow) / 7);
const max = Math.max(...days.map((d) => d.contributionCount), 1);
const best = days.reduce((b, d, i) => (d.contributionCount > days[b].contributionCount ? i : b), 0);

const left = 60, right = W - 60;
const bw = (right - left) / cols;
const depthDX = bw * 0.45, depthDY = bw * 0.38;
const baseY = H - 38;
const fw = bw * 0.88, sideX = bw * 0.36, sideY = bw * 0.24;
const k = (H * 0.43) / Math.sqrt(max);

const ROW_DELAY = 0.12, COL_DELAY = 0.015, RISE = 0.9;
const riseDone = 6 * ROW_DELAY + cols * COL_DELAY + RISE;

function shade(hex, amount) {
  const n2 = parseInt(hex.slice(1), 16);
  const c = [(n2 >> 16) & 255, (n2 >> 8) & 255, n2 & 255];
  const target = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return `rgb(${c.map((v) => Math.round(v + (target - v) * p)).join(",")})`;
}

const bars = [];
// Back to front: row 6 is farthest, so it is written first.
for (let r = 6; r >= 0; r--) {
  for (let c = 0; c < cols; c++) {
    const i = c * 7 + r - startDow;
    if (i < 0 || i >= n) continue;
    const count = days[i].contributionCount;
    const level = LEVEL[days[i].contributionLevel] ?? 0;
    const front = RAMP[level];
    const bh = count === 0 ? 3 : Math.sqrt(count) * k;
    const fx = left + c * bw + r * depthDX;
    const fy = baseY - r * depthDY;
    const begin = (6 - r) * ROW_DELAY + c * COL_DELAY;
    const grow = `<animateTransform attributeName="transform" type="scale" values="1 0;1 1" dur="${RISE}s" begin="${begin.toFixed(3)}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>`;
    // Bars are drawn relative to their base point, so scaling Y grows them up from the ground.
    bars.push(
      `<g transform="translate(${fx.toFixed(2)} ${fy.toFixed(2)})"><g transform="scale(1 1)">${grow}` +
        `<polygon points="${fw},0 ${fw},${-bh} ${fw + sideX},${-bh - sideY} ${fw + sideX},${-sideY}" fill="${shade(front, -0.22)}"/>` +
        `<polygon points="0,${-bh} ${fw},${-bh} ${fw + sideX},${-bh - sideY} ${sideX},${-bh - sideY}" fill="${shade(front, 0.28)}"/>` +
        `<rect x="0" y="${-bh}" width="${fw.toFixed(2)}" height="${bh.toFixed(2)}" fill="${front}"/>` +
        `</g></g>`
    );
  }
}

// Callout on the best day, fading in once the city has risen.
const bc = Math.floor((best + startDow) / 7), br = (best + startDow) % 7;
const bx = left + bc * bw + br * depthDX + fw / 2;
const bTop = baseY - br * depthDY - Math.sqrt(max) * k - sideY;
const labelY = 48;
const big = `${calendar.totalContributions.toLocaleString("en-US")} contributions in the last year`;
const dateStr = new Date(days[best].date + "T00:00:00Z")
  .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  .toUpperCase();
const small = `BEST DAY: ${max} ON ${dateStr}`;
const fade = `<animate attributeName="opacity" from="0" to="1" begin="${riseDone.toFixed(3)}s" dur="0.5s" fill="freeze"/>`;
// Near the right edge, put the label to the left of the best day so it stays inside the card.
const flip = bx > W * 0.6;
const textX = "60";
const anchor = "start";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${calendar.totalContributions} contributions in the last year, drawn as a skyline">
  <rect width="${W}" height="${H}" rx="14" fill="${BG}"/>
  <g font-family="'IBM Plex Mono', Consolas, monospace">
    <g>
      ${fade}


      <text x="${textX}" y="${labelY}" text-anchor="${anchor}" font-family="Georgia, serif" font-size="26" fill="${FG}">${big}</text>
      <text x="${textX}" y="${labelY + 18}" text-anchor="${anchor}" font-size="11" fill="${MUTED}">${small}</text>
    </g>
  </g>
  ${bars.join("\n  ")}
  <text x="60" y="${H - 12}" font-family="Consolas, monospace" font-size="10" fill="${MUTED}">OLDER</text>
  <text x="1040" y="${H - 12}" text-anchor="end" font-family="Consolas, monospace" font-size="10" fill="${MUTED}">RECENT</text>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/skyline.svg", svg);
console.log(`Wrote assets/skyline.svg: ${n} days, ${calendar.totalContributions} contributions for ${login}.`);
