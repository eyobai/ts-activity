import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface Config {
  startDate: string;                // inclusive
  endDate: string;                  // inclusive
  baseMinCommitsPerWeek: number;    // base, before monthly weighting
  baseMaxCommitsPerWeek: number;
  maxCommitsPerDay: number;
  repoPath: string;
  activityFile: string;
  monthlyActivityWeights: Record<string, number>; // "1".."12"
}

const config: Config = {
  // ✅ Now covers 2024 and 2025
  startDate: "2024-01-01",
  endDate: "2025-11-14",

  // Base commits per week (before month weighting)
  baseMinCommitsPerWeek: 3,
  baseMaxCommitsPerWeek: 10, // allow more weeks to be busier

  // ✅ Allow up to 6 commits per day (so 3, 2, 5... are possible)
  maxCommitsPerDay: 6,

  repoPath: process.cwd(),
  activityFile: "src/activity-log.ts",

  // 1 = normal, >1 = more active, <1 = quieter
  monthlyActivityWeights: {
    "1": 0.8,  // Jan  - slightly quieter
    "2": 0.9,  // Feb
    "3": 1.0,  // Mar  - baseline
    "4": 1.1,  // Apr  - more active
    "5": 1.2,  // May
    "6": 1.4,  // Jun  - very active
    "7": 1.4,  // Jul  - very active
    "8": 1.2,  // Aug
    "9": 1.0,  // Sep
    "10": 0.9, // Oct
    "11": 0.8, // Nov
    "12": 0.6, // Dec (in case you extend later)
  },
};

// --- helpers: dates ----------------------------------------------------------

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return d;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function* dateRange(start: Date, end: Date): Generator<Date> {
  const current = new Date(start.getTime());
  while (current <= end) {
    yield new Date(current.getTime());
    current.setDate(current.getDate() + 1);
  }
}

// Week starts on Monday; use that date as the key
function getWeekStartKey(date: Date): string {
  const d = new Date(date.getTime());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffSinceMonday = (day + 6) % 7; // 0 if Monday, 1 if Tuesday, ..., 6 if Sunday
  d.setDate(d.getDate() - diffSinceMonday);
  return formatDate(d);
}

// --- activity-log.ts manipulation -------------------------------------------

function ensureActivityFile(path: string) {
  if (!existsSync(path)) {
    const initialContent = `/**
 * Auto-generated "activity log" to create small, real TypeScript changes
 * over time. Each backfilled commit will append one more entry here.
 */

export interface ActivityEntry {
  date: string;      // ISO date like 2024-01-01
  message: string;   // short description
}

export const activityLog: ActivityEntry[] = [
];
`;
    writeFileSync(path, initialContent, { encoding: "utf8" });
  }
}

function addActivityEntry(path: string, date: string, message: string) {
  const content = readFileSync(path, "utf8");
  const insertIndex = content.lastIndexOf("];");
  if (insertIndex === -1) {
    throw new Error("Could not find activityLog array end in activity-log.ts");
  }

  const before = content.slice(0, insertIndex);
  const after = content.slice(insertIndex);

  const newEntry =
    `  { date: "${date}", message: "${message.replace(/"/g, '\\"')}" },\n`;

  const newContent = before + newEntry + after;
  writeFileSync(path, newContent, { encoding: "utf8" });
}

// --- extra TS file touches ---------------------------------------------------

function ensureDirForFile(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function touchDailyHelperFile(date: Date, commitIndex: number) {
  const dayStr = formatDate(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  const helperPath = join(
    config.repoPath,
    "src",
    "daily",
    `${year}`,
    `${month}`,
    `${dayStr}-commit-${commitIndex}.ts`
  );

  ensureDirForFile(helperPath);

  const content = `// Auto-generated helper for ${dayStr}, commit #${commitIndex}
export function helper_${dayStr.replace(/-/g, "_")}_${commitIndex}() {
  return "${dayStr} – commit ${commitIndex}";
}
`;

  writeFileSync(helperPath, content, { encoding: "utf8" });
}

// --- git utilities -----------------------------------------------------------

function runGit(command: string, env?: NodeJS.ProcessEnv) {
  console.log(`> git ${command}`);
  execSync(`git ${command}`, {
    cwd: config.repoPath,
    stdio: "inherit",
    env: env ?? process.env,
  });
}

// --- message generation ------------------------------------------------------

const commitTypes = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "chore",
  "test",
] as const;

const modules = [
  "auth",
  "user-profile",
  "dashboard",
  "analytics",
  "notifications",
  "settings",
  "payments",
  "api-client",
  "routing",
  "utils",
];

const actions = [
  "add helper",
  "improve typing",
  "cleanup imports",
  "handle edge cases",
  "simplify logic",
  "adjust validation",
  "tweak config",
  "update docs",
  "add tests",
  "optimize function",
];

const activityPhrases = [
  "Polished a small part of the codebase.",
  "Did a small refactor for clarity.",
  "Tweaked typings for better safety.",
  "Added a tiny helper for reuse.",
  "Improved some internal docs.",
  "Made a minor internal change.",
  "Adjusted logic for consistency.",
  "Cleaned up a few details.",
  "Touched a utility to support future work.",
  "Incremental improvement, nothing big.",
];

// function randomItem<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }
function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  // inclusive range
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildCommitMessage(date: Date, index: number): { message: string } {
  const type = randomItem(commitTypes);
  const module = randomItem(modules);
  const action = randomItem(actions);
  const dayStr = formatDate(date);
  const message = `${type}: ${module} – ${action} (${dayStr} #${index})`;
  return { message };
}

function buildActivityMessage(date: Date, index: number): string {
  const phrase = randomItem(activityPhrases);
  const module = randomItem(modules);
  const dayStr = formatDate(date);
  return `[${dayStr} #${index}] ${phrase} (module: ${module}).`;
}

// --- commit creation ---------------------------------------------------------

function createCommitForDate(date: Date, index: number) {
  const iso = date.toISOString();
  const dayStr = formatDate(date);

  const { message: commitMessage } = buildCommitMessage(date, index);
  const activityMessage = buildActivityMessage(date, index);
  const activityFilePath = join(config.repoPath, config.activityFile);

  addActivityEntry(activityFilePath, dayStr, activityMessage);
  touchDailyHelperFile(date, index);

  runGit(`add .`);
  const commitEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_DATE: iso,
    GIT_COMMITTER_DATE: iso,
  };

  runGit(`commit -m "${commitMessage}"`, commitEnv);
}

// --- main logic: weekly planning --------------------------------------------

function main() {
  const start = parseDate(config.startDate);
  const end = parseDate(config.endDate);
  const activityFilePath = join(config.repoPath, config.activityFile);
  ensureActivityFile(activityFilePath);

  console.log(
    `Backfilling commits from ${config.startDate} to ${config.endDate}...`
  );
  console.log(
    `Base weekly commits: ${config.baseMinCommitsPerWeek}–${config.baseMaxCommitsPerWeek}, maxCommitsPerDay: ${config.maxCommitsPerDay}`
  );

  // 1) Group dates by week
  const weeks: Record<string, Date[]> = {};
  for (const date of dateRange(start, end)) {
    const key = getWeekStartKey(date);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(date);
  }

  const weekKeys = Object.keys(weeks).sort();

  for (const weekKey of weekKeys) {
    const dates = weeks[weekKey].sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) continue;

    const firstDate = dates[0];
    const month = String(firstDate.getMonth() + 1);
    const weight = config.monthlyActivityWeights[month] ?? 1;

    let minCommits = Math.round(config.baseMinCommitsPerWeek * weight);
    let maxCommits = Math.round(config.baseMaxCommitsPerWeek * weight);

    if (minCommits < 1) minCommits = 1;
    if (maxCommits < minCommits) maxCommits = minCommits;

    const capacity = dates.length * config.maxCommitsPerDay;
    if (capacity === 0) continue;

    let commitsThisWeek = randomInt(minCommits, maxCommits);
    if (commitsThisWeek > capacity) {
      commitsThisWeek = capacity;
    }

    console.log(
      `\n=== Week starting ${weekKey} (month ${month}, weight ${weight.toFixed(
        2
      )}): planning ${commitsThisWeek} commit(s) ===`
    );

    type DayPlan = { date: Date; count: number };
    const plan: DayPlan[] = dates.map((d) => ({ date: d, count: 0 }));

    // Build slots (each day repeated maxCommitsPerDay times)
    const slots: number[] = [];
    for (let i = 0; i < plan.length; i++) {
      for (let j = 0; j < config.maxCommitsPerDay; j++) {
        slots.push(i);
      }
    }

    shuffle(slots);
    const usedSlots = slots.slice(0, commitsThisWeek);
    for (const idx of usedSlots) {
      plan[idx].count++;
    }

    for (const dayPlan of plan) {
      if (dayPlan.count === 0) continue;

      console.log(
        `  - ${formatDate(dayPlan.date)}: ${dayPlan.count} commit(s)`
      );

      for (let i = 1; i <= dayPlan.count; i++) {
        const commitDate = new Date(dayPlan.date.getTime());
        commitDate.setHours(10 + Math.floor(Math.random() * 8)); // 10–17
        commitDate.setMinutes(Math.floor(Math.random() * 60));

        createCommitForDate(commitDate, i);
      }
    }
  }

  console.log("\nDone. Now you can push with: git push origin main");
}

main();
