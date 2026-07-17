import { randomUUID } from "node:crypto";
import { CASES_PATH } from "./paths.js";
import { withFileLock } from "./file-lock.js";
import { loadJsonArray, saveJsonArray } from "./json-store.js";
import type { Case, CaseTaskLog, CaseOutcome } from "./types.js";

async function loadCases(): Promise<Case[]> {
  return loadJsonArray<Case>(CASES_PATH);
}

async function saveCases(cases: Case[]): Promise<void> {
  await saveJsonArray(CASES_PATH, cases);
}

export async function createCase(objective: string, assignedAssets: string[]): Promise<Case> {
  return withFileLock(CASES_PATH, async () => {
    const cases = await loadCases();
    const newCase: Case = {
      id: randomUUID(),
      objective,
      assignedAssets,
      status: "open",
      openedAt: new Date().toISOString(),
      log: [],
    };
    cases.push(newCase);
    await saveCases(cases);
    return newCase;
  });
}

export async function getCase(id: string): Promise<Case | undefined> {
  const cases = await loadCases();
  return cases.find((c) => c.id === id);
}

export async function listCases(): Promise<Case[]> {
  return loadCases();
}

export async function assignAsset(id: string, asset: string): Promise<Case> {
  return withFileLock(CASES_PATH, async () => {
    const cases = await loadCases();
    const caseRecord = cases.find((c) => c.id === id);
    if (!caseRecord) {
      throw new Error(`No case with id "${id}" found.`);
    }
    if (!caseRecord.assignedAssets.includes(asset)) {
      caseRecord.assignedAssets.push(asset);
      await saveCases(cases);
    }
    return caseRecord;
  });
}

export async function appendLog(id: string, entry: CaseTaskLog): Promise<Case> {
  return withFileLock(CASES_PATH, async () => {
    const cases = await loadCases();
    const caseRecord = cases.find((c) => c.id === id);
    if (!caseRecord) {
      throw new Error(`No case with id "${id}" found.`);
    }
    caseRecord.log.push(entry);
    await saveCases(cases);
    return caseRecord;
  });
}

export async function closeCase(id: string, summary?: string, outcome?: CaseOutcome): Promise<Case> {
  return withFileLock(CASES_PATH, async () => {
    const cases = await loadCases();
    const caseRecord = cases.find((c) => c.id === id);
    if (!caseRecord) {
      throw new Error(`No case with id "${id}" found.`);
    }
    caseRecord.status = "closed";
    caseRecord.closedAt = new Date().toISOString();
    if (summary) caseRecord.summary = summary;
    if (outcome) caseRecord.outcome = outcome;
    await saveCases(cases);
    return caseRecord;
  });
}
