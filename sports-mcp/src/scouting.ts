// Talent identification — the part John most wants. Built on the "four corners"
// model soccer academies actually use, plus the concrete markers scouts watch
// for, the development pathway, and the honest caveats (relative age effect,
// late bloomers, the odds). Soccer-centric; the principles carry to any sport.

export function scoutTalent(sport?: string): string {
  const s = sport ? ` (${sport})` : "";
  return [
    `HOW TALENT IS IDENTIFIED${s} — the four-corners model scouts actually use`,
    `BOTTOM LINE: real scouting isn't "he scored a great goal." It's judging a player across FOUR areas, over many games, against their age — and knowing the judgment is imperfect.`,
    ``,
    `1. TECHNICAL — what they can do with the ball.`,
    `   First touch (does it set up the next move or kill it?), passing range & weight, dribbling, striking, weak-foot ability, control under pressure. In soccer, first touch and both feet are gold.`,
    `2. TACTICAL — what they know.`,
    `   SCANNING (checking their shoulders BEFORE the ball arrives — the #1 marker of elite awareness), decision speed, positioning, off-the-ball movement, reading the game two moves ahead. This is the one casual fans miss and scouts obsess over.`,
    `3. PHYSICAL — what their body can do.`,
    `   Speed, acceleration, agility, stamina, balance, coordination. IMPORTANT: raw physicality at a young age is the most OVER-rated corner — it fades as everyone matures, and it hides technical gaps.`,
    `4. PSYCHOLOGICAL — what's between the ears.`,
    `   Composure, work rate, resilience (how they respond to a mistake or a bad game), coachability, leadership, competitiveness. Coaches say this corner decides who actually 'makes it' among the talented.`,
    ``,
    `The pros weight it roughly: technical + tactical tell you the ceiling; psychological tells you if they'll reach it; physical is necessary but the least predictive young.`,
  ].join("\n");
}

export function whatToLookFor(): string {
  return [
    `WHAT TO LOOK FOR IN A PLAYER — the concrete signs of real talent (soccer, but it travels)`,
    `BOTTOM LINE: watch the things that happen WITHOUT the ball and BEFORE the ball — that's where talent hides. Highlights lie; habits don't.`,
    ``,
    `THE TELLS SCOUTS TRUST:`,
    `  • SCANNING — do they check over their shoulders before receiving? Constant scanning = a brain that's always a step ahead.`,
    `  • FIRST TOUCH — does the first touch set up the next action (into space, away from pressure)? Or do they have to stop and reset?`,
    `  • DECISION SPEED — do they play the pass that WAS on, before it closed? Slow feet can be coached; a slow brain rarely is.`,
    `  • OFF-BALL MOVEMENT — do they create space, time runs, drift into gaps? A player who's dangerous without the ball is rare.`,
    `  • COMPOSURE — calm in tight space and at big moments, or do they panic and rush?`,
    `  • CONSISTENCY & RESPONSE — good across many games (not one highlight), and how do they react right after a mistake?`,
    `  • ATTITUDE — body language toward teammates, the coach, and a bad call. Coachability is a talent.`,
    ``,
    `THE HONEST CAVEATS (this is where most talent-spotting goes wrong):`,
    `  • RELATIVE AGE EFFECT — kids born early in the selection year are bigger/stronger and get picked far more often. That's a birthday advantage, NOT more talent. Scouts who ignore it miss real players and over-rate physical early-birthday kids.`,
    `  • LATE BLOOMERS get released and then explode later (many pros were cut as teens). A snapshot at 12 predicts little.`,
    `  • ONE GAME ≠ THE SIGNAL — judge trajectory and consistency, not a single good or bad day.`,
    `  • THE ODDS ARE TINY — the chance of going pro from youth is a fraction of a percent. So develop for love of the game and life skills, keep school/a plan B, and let 'making it' be a bonus, not the point.`,
  ].join("\n");
}

export function pathway(): string {
  return [
    `THE PATHWAY — how a player actually gets seen and develops (soccer)`,
    `BOTTOM LINE: development beats being 'discovered'. Get good, play a lot, and put yourself where eyes are — but keep it in perspective.`,
    ``,
    `  1. PLAY CONSTANTLY — pickup, street, futsal, club. Thousands of touches and small-sided games build the technique + decisions no drill can.`,
    `  2. CLUB / ACADEMY — join the best team you can handle; being stretched by better players accelerates growth. Academies scout their regions.`,
    `  3. GET SEEN — trials, showcases, ID camps, and (increasingly) recorded footage. Coaches and school/college pathways matter, especially in the US.`,
    `  4. STAND OUT ON THE FOUR CORNERS — not just goals; the scanning, first touch, and attitude that scouts actually log.`,
    `  5. KEEP A PLAN B — school, other skills. The pro odds are a lottery; the discipline, teamwork, and fitness you build are the guaranteed payout.`,
    ``,
    `For current academy/trial specifics in your area, ask research — programs and routes differ a lot by country (and the jobhunt asset covers turning any skill into a career).`,
  ].join("\n");
}
