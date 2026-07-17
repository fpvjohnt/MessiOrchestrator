import { fuzzyFind, displayKey } from "./match.js";

interface Player { motive: string; thinks: string; clash: string; move: string; }

export const PLAYERS: Record<string, Player> = {
  recruiter: {
    motive: "Fills lots of roles fast. Measured on speed and volume, not on finding the 'perfect' you.",
    thinks: "Skim for obvious fit and easy reasons to say NO (to shrink the pile). Keyword match, right title, no red flags.",
    clash: "They're screening OUT, not in. A 6-second skim decides your fate; anything unclear gets cut.",
    move: "Make fit obvious in 6 seconds: mirror the job's keywords, put the best up top, no clutter. Be easy to say YES to.",
  },
  hiring_manager: {
    motive: "Has a PROBLEM and needs someone to solve it without creating new problems. It's their team and their risk.",
    thinks: "Can this person do the job day one (or learn fast), and will they fit the team? Will hiring them make my life easier or harder?",
    clash: "They don't care about your needs yet — they care about their problem. Generic 'I'm a hard worker' means nothing to them.",
    move: "Show you solve THEIR specific problem with a past result. Reduce their risk: proof, references, clear fit.",
  },
  ats_robot: {
    motive: "Software that ranks resumes by keyword match so humans read fewer of them.",
    thinks: "Does this resume contain the words in the job posting? Score and sort. It doesn't understand meaning — only matches.",
    clash: "It rejects qualified people over wording and formatting. It has zero judgment.",
    move: "Feed it the exact keywords from the post, in simple formatting it can read ('beat_the_ats').",
  },
  hr: {
    motive: "Protects the company (compliance, fairness, paperwork) and runs onboarding.",
    thinks: "Are the forms done, background/reference checks clean, offer within band, new hire set up right.",
    clash: "Not your advocate or your enemy — a process gate. Salary 'bands' can limit your offer.",
    move: "Be responsive and organized with paperwork. Negotiate salary before you sign (see 'negotiate_salary').",
  },
  references: {
    motive: "Former managers/colleagues who vouch for you — their word carries real weight.",
    thinks: "Will I honestly recommend this person? A lukewarm reference quietly kills offers.",
    clash: "A surprised or unprepared reference can hurt you without meaning to.",
    move: "Ask people who genuinely rate you, ASK first, and PREP them: the role, what to emphasize, your best wins.",
  },
};

export function howTheyThink(role?: string): string {
  if (!role) {
    return (
      `WHO DECIDES YOUR FATE — and what they actually want:\n\n` +
      Object.entries(PLAYERS).map(([k, p]) => `▸ ${displayKey(k)}: ${p.motive}`).join("\n") +
      `\n\nAsk for any by name. The theme: nobody owes you a job — make it easy and low-risk to pick you.`
    );
  }
  const found = fuzzyFind(PLAYERS, role);
  if (!found) return `Don't know "${role}". I have: ${Object.keys(PLAYERS).join(", ")}.`;
  const p = found.value;
  return [`${displayKey(found.key)} — BOTTOM LINE: ${p.motive}`, ``, `How they think: ${p.thinks}`, `Where it clashes with you: ${p.clash}`, `Your move: ${p.move}`].join("\n");
}

interface Flag { bottom_line: string; looks_like: string; why: string; move: string; }

export const RED_FLAGS: Record<string, Flag> = {
  generic_resume: {
    bottom_line: "One resume blasted to 100 jobs is why you hear nothing. Tailor or get ignored.",
    looks_like: "Same PDF to every posting, no keywords from the job, 'objective: seeking a challenging role.'",
    why: "The ATS robot scores you against EACH post; a generic resume matches none well and auto-rejects.",
    move: "Tailor each application to the post's keywords ('beat_the_ats'). Quality over spray-and-pray.",
  },
  ats_breaking_format: {
    bottom_line: "Fancy resume templates (columns, graphics, tables) can be unreadable to the robot — instant reject.",
    looks_like: "Two-column 'designer' templates, text boxes, icons, photos, headshots, logos.",
    why: "Many ATS parsers scramble or drop that content, so your skills never register.",
    move: "Use a clean one-column layout with standard headings. Pretty doesn't matter if the robot can't read it.",
  },
  online_only: {
    bottom_line: "Applying ONLY through job portals is the slow lane — most jobs are filled through people.",
    looks_like: "Submitting 200 online apps, never networking or reaching a human.",
    why: "Referrals get seen first (the 'hidden job market'); portal apps compete with hundreds and hit the robot.",
    move: "Also network: find the hiring manager, get referrals ('find_hiring_manager'). Portals PLUS people.",
  },
  lowballing_yourself: {
    bottom_line: "Naming a low number first, or grabbing the first offer out of fear, can cost you thousands.",
    looks_like: "'I'll take whatever' / accepting instantly / afraid asking for more loses the offer.",
    why: "Employers expect some negotiation; you rarely lose a real offer by asking professionally. The first offer is usually not their max.",
    move: "Research the range and negotiate ('negotiate_salary'). Check it against a CA living wage ('living_wage').",
  },
  no_follow_up: {
    bottom_line: "Going silent after applying or interviewing quietly kills your chances.",
    looks_like: "No thank-you note, no check-in, assuming 'they'll call if interested.'",
    why: "A short, polite follow-up keeps you top of mind and signals real interest — many candidates skip it.",
    move: "Thank-you note within a day of an interview; a polite check-in after ~1 week. Professional, not pushy.",
  },
  ghost_jobs: {
    bottom_line: "Some postings aren't real — reposted forever, or 'Easy Apply' listings that aren't even on the company's site. You apply into a void.",
    looks_like: "LinkedIn Easy Apply with no matching role on the company careers page; postings up for months and re-listed; vague 'always hiring' reqs.",
    why: "Companies collect resumes, keep 'evergreen' postings, or leave dead listings up. You get auto-rejected or ghosted with zero signal.",
    move: "Before applying, check the company's OWN careers page for the role ('vet_company'). Prioritize real, dated, on-site postings and referrals.",
  },
  dead_end_job: {
    bottom_line: "A job with no path up traps you — you can be stuck for years with no raise or promotion.",
    looks_like: "Reviews saying 'no growth / no promotions / dead end'; roles where nobody above you ever started where you are.",
    why: "Some places hire you to stay put. Years pass, your pay stalls, and you fall behind the market.",
    move: "Vet advancement BEFORE accepting ('vet_company'): ask 'who moved up from this role?' Have a 'career_path' in mind so any job is a rung, not a cage.",
  },
  job_scams: {
    bottom_line: "'Jobs' that ask for money, your bank login, or gift cards up front are scams. Real jobs pay YOU.",
    looks_like: "Instant hire with no interview, pay for 'training/equipment', check-cashing 'jobs', vague companies.",
    why: "They steal money or identity. A legit employer never asks you to pay to work.",
    move: "Never pay to get a job or share bank/SSN before a verified offer. Verify the company independently.",
  },
};

export function redFlag(issue?: string): string {
  if (!issue) return `JOB-SEARCH TRAPS — one line each; ask for any:\n\n` + Object.entries(RED_FLAGS).map(([k, f]) => `▸ ${displayKey(k)}: ${f.bottom_line}`).join("\n");
  const found = fuzzyFind(RED_FLAGS, issue);
  if (!found) return `Don't know "${issue}". I have: ${Object.keys(RED_FLAGS).join(", ")}.`;
  const f = found.value;
  return [`${displayKey(found.key)} — BOTTOM LINE: ${f.bottom_line}`, ``, `What it looks like: ${f.looks_like}`, `Why it hurts you: ${f.why}`, `Your move: ${f.move}`].join("\n");
}
