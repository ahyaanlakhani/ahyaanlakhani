// Builds light and dark contribution-graph SVGs for the profile README.
// Usage: GITHUB_TOKEN=... node scripts/contributions.mjs <login>
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

// GitHub's own five levels, lightest to darkest.
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const THEMES = {
  light: { empty: "#ebedf0", ramp: ["#9be9a8", "#40c463", "#30a14e", "#216e39"], text: "#57606a", bg: "#ffffff" },
  dark: { empty: "#161b22", ramp: ["#0e4429", "#006d32", "#26a641", "#39d353"], text: "#8b949e", bg: "#0d1117" },
};

const CELL = 11;
const GAP = 3;
const LEFT = 28;
const TOP = 34;
const weeks = calendar.weeks;
const width = LEFT + weeks.length * (CELL + GAP) + 10;
const height = TOP + 7 * (CELL + GAP) + 12;

function svgFor(theme) {
  const t = THEMES[theme];
  const cells = [];
  weeks.forEach((week, x) => {
    week.contributionDays.forEach((day) => {
      const level = LEVEL[day.contributionLevel] ?? 0;
      const fill = level === 0 ? t.empty : t.ramp[level - 1];
      const cx = LEFT + x * (CELL + GAP);
      const cy = TOP + new Date(day.date + "T00:00:00Z").getUTCDay() * (CELL + GAP);
      cells.push(
        `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`
      );
    });
  });
  const label = `${calendar.totalContributions.toLocaleString("en-US")} contributions in the last year`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <rect width="${width}" height="${height}" fill="${t.bg}" fill-opacity="0"/>
  <text x="${LEFT}" y="20" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${t.text}">${label}</text>
  ${cells.join("\n  ")}
</svg>
`;
}

mkdirSync("assets", { recursive: true });
writeFileSync("assets/contributions-light.svg", svgFor("light"));
writeFileSync("assets/contributions-dark.svg", svgFor("dark"));
console.log(`Wrote ${weeks.length} weeks, ${calendar.totalContributions} contributions for ${login}.`);
