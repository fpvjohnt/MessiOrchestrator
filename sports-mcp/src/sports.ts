// Sports, centered on soccer. Soccer gets the deep treatment (how it works,
// positions, formations, tactics); other major sports get a solid summary.
// Plain words, bottom-line first.

const clean = (s: string) => s.replace(/[\r\n"]+/g, " ").replace(/\s+/g, " ").trim();

export interface Sport {
  label: string;
  keys: string[];
  how_it_works: string;
  positions?: string;
  talent_snapshot: string; // what talent looks like in this sport, in brief
  depth: "deep" | "summary";
}

export const SPORTS: Record<string, Sport> = {
  soccer: {
    label: "Soccer (Football)",
    keys: ["soccer", "football", "futbol", "pitch", "goal", "striker", "midfielder", "defender", "goalkeeper", "offside", "fifa", "premierleague", "laliga", "worldcup", "messi", "ronaldo"],
    how_it_works:
      "Two teams of 11 (10 outfield + 1 goalkeeper) try to put the ball in the other net over two 45-minute halves. " +
      "Only the keeper may use hands, and only inside their box. Key rules: OFFSIDE (an attacker can't be behind the last " +
      "defender when the ball is played to them), fouls, yellow/red cards, and set pieces (corners, free kicks, penalties). " +
      "Low-scoring and continuous — that's why space, movement, and one moment of quality decide games.",
    positions:
      "Goalkeeper (GK) → last line, uses hands in the box. Defenders: center-backs (CB, central wall) + full-backs (LB/RB, " +
      "wide, now often attack too). Midfielders: defensive (CDM, shields the defense), central (CM, the engine), attacking " +
      "(CAM, creates chances), wingers (wide, pace + crossing). Forwards: striker (CF, scores) + wingers. Formations name the " +
      "shape from the back: 4-4-2 (balanced), 4-3-3 (attacking, wide), 3-5-2 (wing-backs, midfield control), 4-2-3-1 (modern default).",
    talent_snapshot: "First touch, scanning before receiving, decision speed, off-ball movement, composure under pressure — see scout_talent for the full model.",
    depth: "deep",
  },
  basketball: {
    label: "Basketball",
    keys: ["basketball", "nba", "hoops", "dunk", "pointguard", "rebound"],
    how_it_works: "Five per side; put the ball through the hoop (2 or 3 points, 1 for a free throw). Continuous, high-scoring, possession clock. Positions: point guard (runs the offense), shooting guard, small/power forward, center. Space, shooting, and quick decisions rule the modern game.",
    talent_snapshot: "Court vision, shooting form, first step / explosiveness, and basketball IQ (reading the defense). Height helps but skill + decision-making travel.",
    depth: "summary",
  },
  american_football: {
    label: "American Football",
    keys: ["americanfootball", "nfl", "quarterback", "touchdown", "gridiron"],
    how_it_works: "Eleven per side; advance the ball 10 yards at a time in 4 'downs' to score a touchdown (6) or field goal (3). Highly specialized offense/defense/special teams. The quarterback runs the offense; the line protects; skill players (RB/WR) move the ball.",
    talent_snapshot: "Position-specific: arm + reads (QB), speed + hands (WR), explosiveness + vision (RB), size + technique (line). Football IQ and toughness across all.",
    depth: "summary",
  },
  baseball: {
    label: "Baseball",
    keys: ["baseball", "mlb", "pitcher", "batter", "homerun", "innings"],
    how_it_works: "Nine per side; a pitcher throws, a batter tries to hit and run the bases to score. Nine innings of pitch-by-pitch duels. A slow-looking game of fast, precise skills and constant probability.",
    talent_snapshot: "Bat speed + pitch recognition (hitting), velocity + command + spin (pitching), plus fielding range and arm. Hand-eye coordination is king.",
    depth: "summary",
  },
  tennis: {
    label: "Tennis",
    keys: ["tennis", "atp", "wta", "serve", "grandslam", "racket", "racquet"],
    how_it_works: "One vs one (or doubles); hit the ball into the opponent's court so they can't return it, winning points → games → sets → match. A physical chess match of serve, movement, and shot patterns.",
    talent_snapshot: "Movement/footwork, clean technique, serve, and mental toughness under pressure (it's you alone out there). Anticipation separates the great.",
    depth: "summary",
  },
  rugby: {
    label: "Rugby",
    keys: ["rugby", "scrum", "try", "lineout"],
    how_it_works: "Fifteen (union) or thirteen (league) per side; carry/pass the ball (backwards only) to ground it over the line for a 'try'. Continuous, physical, territory-based.",
    talent_snapshot: "Power + speed, handling under contact, game sense, and fearlessness. Position dictates the physical profile.",
    depth: "summary",
  },
  cricket: {
    label: "Cricket",
    keys: ["cricket", "bowler", "batsman", "wicket", "over", "ipl"],
    how_it_works: "Eleven per side; a bowler bowls, a batter scores runs, the field tries to get them out. Formats from 5-day Tests to 3-hour T20. A game of patience, angles, and probability.",
    talent_snapshot: "Timing + shot selection (batting), pace/spin + control (bowling), and temperament over a long game.",
    depth: "summary",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-/]+/g, "").replace(/[^a-z0-9]/g, "");
}

const SPORT_INDEX: Record<string, string> = {};
for (const [key, sp] of Object.entries(SPORTS)) {
  SPORT_INDEX[normalize(key)] = key;
  SPORT_INDEX[normalize(sp.label)] = key;
  for (const k of sp.keys) SPORT_INDEX[normalize(k)] = key;
}

export function resolveSport(input: string): string | undefined {
  const norm = normalize(input);
  if (Object.hasOwn(SPORT_INDEX, norm)) return SPORT_INDEX[norm];
  if (norm.length < 3) return undefined;
  const hit = Object.entries(SPORT_INDEX).find(([k]) => k.includes(norm) || norm.includes(k));
  return hit?.[1];
}

export function explainSport(sport?: string): string {
  if (!sport) {
    return (
      `SPORTS — soccer is the deep one here; the rest are covered solidly. Pick one:\n\n` +
      Object.values(SPORTS).map((s) => `▸ ${s.label}${s.depth === "deep" ? " ★" : ""}: ${s.how_it_works.split(".")[0]}.`).join("\n") +
      `\n\nFor talent identification / scouting (how people know you've got it) use scout_talent. For what to watch for in a young player use what_to_look_for.`
    );
  }
  const key = resolveSport(sport);
  if (!key) return `Not sure which sport "${clean(sport)}" is. Covered: ${Object.values(SPORTS).map((s) => s.label).join(", ")}.`;
  const s = SPORTS[key];
  const out = [
    `${s.label}${normalize(sport) !== normalize(key) ? ` (from "${clean(sport)}")` : ""}`,
    `BOTTOM LINE: ${s.how_it_works}`,
  ];
  if (s.positions) out.push(``, `Positions & shape: ${s.positions}`);
  out.push(``, `What talent looks like: ${s.talent_snapshot}`);
  if (s.depth === "summary") out.push(``, `(This one's a summary — for current teams, stats, and rules details, ask research. Soccer has the deepest coverage here.)`);
  return out.join("\n");
}

export function startHere(): string {
  return [
    `BOTTOM LINE: this is sports — soccer most of all — how the game works and how people actually know when someone has talent.`,
    ``,
    `  • How a sport works → 'explain_sport <sport>' (soccer is the deep one; others are solid summaries).`,
    `  • How talent is judged → 'scout_talent' (the four-corners model scouts use).`,
    `  • What to watch for in a player → 'what_to_look_for' (the real tells + honest caveats).`,
    `  • How a player gets seen/develops → 'pathway'.`,
    ``,
    `Current teams, scores, transfers, and local academies change constantly — ask research for those; this asset is the how-it-works and how-talent-is-spotted.`,
  ].join("\n");
}
