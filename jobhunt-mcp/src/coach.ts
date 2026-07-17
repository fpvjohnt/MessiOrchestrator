import { fuzzyFind, displayKey } from "./match.js";

// Job-search coaching. Bottom-line first, kid-simple, honest. Not a promise of a
// job — a way to stop failing at the gate you didn't know existed.

export function theFunnel(): string {
  return [
    `BOTTOM LINE: your resume passes through GATES, and most people die at one they didn't know existed. Find your broken gate ('diagnose').`,
    ``,
    `  1. ATS ROBOT — software scans your resume for keywords from the job post. No match = auto-reject, a human never sees it.`,
    `  2. RECRUITER — a 6-second skim for obvious fit. Sloppy or unclear = out.`,
    `  3. HIRING MANAGER — "does this person solve MY problem and lower MY risk?"`,
    `  4. INTERVIEW — proof you can do it AND that you fit the team.`,
    `  5. OFFER + NEGOTIATION — where you gain or lose thousands.`,
    `  6. ONBOARDING — paperwork, rules, training, first 90 days.`,
    ``,
    `The move: tailor for gate 1, be clear for gate 2, solve-their-problem for gate 3. Run 'diagnose' to find exactly where you're stuck.`,
  ].join("\n");
}

export function beatTheAts(): string {
  return [
    `BOTTOM LINE: a robot reads your resume before any human. It matches KEYWORDS from the job post — so mirror their words, or you're auto-rejected.`,
    ``,
    `How the robot works: it scans for the skills/titles/keywords in the job description and scores your match. Low score = the "sorry, not a fit" email, often before a person ever looks.`,
    ``,
    `Beat it:`,
    `  • Read the JOB POST and reuse its exact words (if it says "customer success", don't only say "client support").`,
    `  • Match your skills to their required list — name the tools/certs they name (truthfully).`,
    `  • Keep formatting SIMPLE: one column, standard headings (Experience, Education, Skills). No tables, text boxes, graphics, or columns — they scramble the robot.`,
    `  • Use a normal font, save as PDF unless they ask otherwise, spell out AND abbreviate ("Registered Nurse (RN)").`,
    `  • TAILOR every application. One generic resume blasted everywhere is why months pass with silence.`,
    ``,
    `Reality: this is why qualified people get rejected in seconds. It's usually a keyword miss, not you.`,
  ].join("\n");
}

export function resumeTips(): string {
  return [
    `BOTTOM LINE: every bullet = what you DID + the RESULT, in a number. "Did tasks" loses; "cut checkout time 20%" wins.`,
    ``,
    `  • Lead each bullet with an action + a measurable result (%, $, time, count). Numbers beat adjectives.`,
    `  • Put your best, most relevant stuff in the top third — recruiters skim ~6 seconds.`,
    `  • Tailor to EACH job: mirror its keywords (see 'beat_the_ats').`,
    `  • Cut fluff ("hard-working team player"). Show it with a result instead.`,
    `  • No experience? Use school projects, volunteer work, and transferable skills from ANY job (reliability, customer service, cash handling, scheduling).`,
    `  • One page if under ~10 years' experience. Clean, simple format (ATS-safe).`,
    ``,
    `Turn "responsible for the register" into "handled $2k+ daily cash with zero shortages over 12 months." Same job — one gets interviews.`,
  ].join("\n");
}

export function interviewPrep(): string {
  return [
    `BOTTOM LINE: they're deciding two things — can you DO the job, and do they want to WORK with you. Prove both with stories, not adjectives.`,
    ``,
    `  • Use STAR for every example: Situation → Task → Action → Result. Tell it like a short story with a number at the end.`,
    `  • Prep 5-6 stories from your past that show problem-solving, teamwork, handling pressure, a win.`,
    `  • Research the company + the role's real problem; connect your stories to THAT.`,
    `  • For "tell me about yourself": 60 seconds — past, present, why this role. Not your life story.`,
    `  • ALWAYS have questions to ask them ("what does success look like in 90 days?"). No questions = looks uninterested.`,
    `  • Follow up with a thank-you note within a day. Cheap, and many skip it.`,
    ``,
    `Nervous is normal. Preparation beats confidence — rehearse your stories out loud.`,
  ].join("\n");
}

export function findHiringManager(): string {
  return [
    `BOTTOM LINE: getting to the REAL hiring manager (not the job portal) is how you skip the robot. LinkedIn is how you find them.`,
    ``,
    `  • On LinkedIn, search the company + the team/title you'd report to (e.g. "IT Manager at <company>").`,
    `  • Read what THEY care about (their posts, the job post's pain points) so you speak to their problem.`,
    `  • A short, specific message beats a mass apply: who you are, the role, one reason you fit, one question.`,
    `  • Look for a referral path — anyone you know at the company. Referred candidates get seen first (the "hidden job market").`,
    `  • Line up references early: former managers/colleagues who'll vouch with specifics. Ask them first, prep them on the role.`,
    ``,
    `Have research pull it: search '"<role>" "<company>" hiring manager LinkedIn' and the company's team page. Networking beats the portal almost every time.`,
  ].join("\n");
}

// ---- The diagnostic: symptom -> broken gate -> fix ------------------------

interface Diagnosis { gate: string; likely_causes: string[]; fixes: string[] }

export const DIAGNOSES: Record<string, Diagnosis> = {
  no_responses: {
    gate: "Gate 1-2: the ATS robot / recruiter skim — a human may never be seeing you.",
    likely_causes: ["Resume keywords don't match the job posts.", "ATS-breaking formatting (tables/columns/graphics).", "Applying only online, to roles you're not keyword-matched for.", "Generic resume sent everywhere."],
    fixes: ["Tailor each resume to the post's exact keywords ('beat_the_ats').", "Strip fancy formatting to a simple one-column layout.", "Network to the hiring manager directly ('find_hiring_manager').", "Apply to fewer jobs, better-matched, tailored."],
  },
  no_interviews: {
    gate: "Gate 2-3: you're seen but not compelling — recruiter/manager isn't convinced you fit.",
    likely_causes: ["Resume shows duties, not results/numbers.", "Missing a key skill/cert the role wants.", "Unclear how your background maps to THIS role.", "Weak or empty LinkedIn."],
    fixes: ["Rewrite bullets as achievements with numbers ('resume_tips').", "Check the skill gap and the cheapest way to close it ('career_path').", "Add a 2-line summary connecting your past to the target role.", "Clean up LinkedIn to match your resume."],
  },
  no_offers: {
    gate: "Gate 4: interviews aren't converting — the do-the-job or fit-the-team proof is missing.",
    likely_causes: ["Answers are vague, no STAR stories with results.", "Not researching the company/role's real problem.", "Not asking questions / no follow-up.", "Nerves reading as low interest."],
    fixes: ["Prep 5-6 STAR stories and rehearse out loud ('interview_prep').", "Tie every answer to the role's actual problem.", "Always ask smart questions + send a thank-you.", "Do mock interviews until the stories are smooth."],
  },
  low_pay: {
    gate: "Gate 5: you get offers but they're too low — negotiation and targeting.",
    likely_causes: ["Accepting the first number out of fear.", "Not researching the market range.", "Targeting roles below your value or below a CA living wage."],
    fixes: ["Learn to negotiate — you rarely lose an offer by asking ('negotiate_salary').", "Research the real range for the role + area.", "Check it against your living wage ('living_wage'); aim at roles that clear it."],
  },
  no_direction: {
    gate: "Before the funnel: you don't know what to aim for.",
    likely_causes: ["Only done one kind of work (retail, etc.) and can't see other options.", "Degree but no idea what career it leads to.", "Picking the 'easiest' job, which dead-ends."],
    fixes: ["Find fitting directions from your background + work style ('career_match').", "Map a path from where you are to a real target ('career_path').", "Check what those roles pay vs. your living wage ('living_wage')."],
  },
};

export function diagnose(symptom?: string): string {
  if (!symptom) {
    return (
      `WHY AM I STUCK? Tell me how far you get:\n\n` +
      `  ▸ no_responses — I apply and hear nothing.\n` +
      `  ▸ no_interviews — I get some replies but no interviews.\n` +
      `  ▸ no_offers — I interview but get no offers.\n` +
      `  ▸ low_pay — I get offers but the pay is too low.\n` +
      `  ▸ no_direction — I don't even know what job to aim for.\n\n` +
      `Ask with one of those (e.g. "no_responses") and I'll tell you the broken gate and the fix.`
    );
  }
  const found = fuzzyFind(DIAGNOSES, symptom);
  if (!found) return `Tell me one of: ${Object.keys(DIAGNOSES).join(", ")}.`;
  const d = found.value;
  return [
    `DIAGNOSIS: ${displayKey(found.key)}`,
    `BOTTOM LINE: ${d.gate}`,
    ``,
    `Likely causes:`,
    ...d.likely_causes.map((x) => `  • ${x}`),
    ``,
    `Your fixes (in order):`,
    ...d.fixes.map((x, i) => `  ${i + 1}. ${x}`),
    ``,
    `Most job-search pain is ONE fixable gate — not "you're unhireable." Work the fixes above and re-check.`,
  ].join("\n");
}
