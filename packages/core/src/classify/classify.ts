// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The comparator — where the declaration-blind derived profile finally meets what the tool declared.
// For each comparable aspect (destructiveness, external reach, reversibility) it sets derived risk
// against the EFFECTIVE declared value (the explicit hint, or the MCP spec default when absent) and
// emits at most one RawFinding per aspect. A clean tool emits none.
//
// The whole judgment is the asymmetry:
//   under-declared (an explicit false claim that removes a spec-default safety prompt) ≫
//   undeclared (silence the spec default already covers, a low nudge) ≈
//   over-declared (honest over-caution, alarm fatigue).
// Absence is NOT falsehood: comparing against the effective value is what encodes that.

import type { DeclaredProfile } from '../declared.ts';
import { effectiveDeclaredValue, MCP_HINT_DEFAULTS } from '../declared.ts';
import type { ActionRiskProfile, Confidence, Dimension } from '../dimensions.ts';
import type { RuleId } from '../primitives.ts';
import type { RawFinding } from './raw-finding.ts';
import { RULE } from './rule-ids.ts';

// A small constructor so every emitted RawFinding carries the driving dimension's confidence and
// provenance uniformly.
function raw(ruleId: RuleId, verdict: RawFinding['verdict'], driver: Dimension<string>): RawFinding {
  return { ruleId, verdict, confidence: driver.confidence, signals: driver.provenance };
}

// Whether a derived dimension rests on positive evidence. An `unknown` reading has two very
// different origins: a signal that fired but explicitly declined to bound the level (evidence-backed
// unknown — non-empty provenance), and silence, where no signal fired at all (empty provenance).
// Only the former may contradict an explicit honest declaration. Silence is the absence of evidence,
// and absence of evidence is not evidence of dishonesty: letting it fire a verdict-bearing finding
// manufactures an accusation out of the linter's own vocabulary gap, and ships a finding whose only
// "reason" is that nothing was found (Invariant 2). Conservatism still lives where it belongs — the
// composer derives silence to `unknown`, never to a safe level, and that unknown still appears in the
// report; the comparator simply refuses to turn it into an alarm.
function hasEvidence(driver: Dimension<string>): boolean {
  return driver.provenance.length > 0;
}

// A mutating tool that denies destructiveness is only under-declared when its irreversibility
// corroborates that the mutation is not a benign in-place flip. The MCP destructiveHint guards
// *irrecoverable* updates; a reversible state flip that honestly declares `destructiveHint:false`
// (a toggle, a settable flag) is consistent, not dishonest. `deleting` is irrecoverable by nature and
// needs no corroboration; `mutating` does — either a positive irreversibility reading or an
// evidence-backed unknown one (a signal that argued the reversibility is genuinely in question).
function mutationIsIrrecoverable(derived: ActionRiskProfile): boolean {
  const rev = derived.reversibility;
  return rev.level === 'irreversible' || (rev.level === 'unknown' && hasEvidence(rev));
}

const WRITE_LEVELS: ReadonlySet<string> = new Set(['additive', 'mutating', 'deleting']);
const DESTRUCTIVE_WRITE_LEVELS: ReadonlySet<string> = new Set(['mutating', 'deleting']);

// --- Destructiveness aspect (hints: readOnlyHint + destructiveHint) ---------------------------
//
// Governed by two hints, resolved to a single verdict so the classifier never double-fires
// write-as-readonly and destructive-unflagged for the same dishonesty (hint-interaction rule 1:
// a readOnlyHint:true claim moots destructiveHint). First match wins — that IS the per-aspect dedup.
function destructivenessFinding(derived: ActionRiskProfile, declared: DeclaredProfile): RawFinding | null {
  const d = derived.destructiveness;
  const level = d.level;
  const isRead = level === 'read-only';
  const isWrite = WRITE_LEVELS.has(level);
  const isDestructiveWrite = DESTRUCTIVE_WRITE_LEVELS.has(level);
  const isUnknown = level === 'unknown';

  const readOnly = effectiveDeclaredValue(declared.readOnly, MCP_HINT_DEFAULTS.readOnly);
  const destructive = effectiveDeclaredValue(declared.destructive, MCP_HINT_DEFAULTS.destructive);

  // 1. An explicit read-only claim. It denies all mutation, so it is the most specific verdict on
  //    this aspect and suppresses destructiveHint entirely.
  if (readOnly === 'explicit-true') {
    // A write contradicts the read-only claim outright. An evidence-backed uncertain reading (a
    // signal that fired but declined to bound the level) is a soft contradiction — the confidence
    // carried through softens the severity, never hides it. Silence — no signal at all — cannot
    // contradict an explicit honest claim (see hasEvidence).
    if (isWrite || (isUnknown && hasEvidence(d))) return raw(RULE.writeAsReadonly, 'under-declared', d);
    return null; // read-only tool declaring read-only, or one we cannot prove otherwise: consistent.
  }

  // 2. An explicit denial of destructiveness on a tool that mutates or deletes. `deleting` is
  //    irrecoverable by nature and is under-declared outright; `mutating` is only under-declared when
  //    corroborated as irrecoverable — a reversible in-place flip declaring destructiveHint:false is
  //    honest, not dishonest (mutationIsIrrecoverable).
  if (destructive === 'explicit-false') {
    if (level === 'deleting') return raw(RULE.destructiveUnflagged, 'under-declared', d);
    if (level === 'mutating' && mutationIsIrrecoverable(derived)) {
      return raw(RULE.destructiveUnflagged, 'under-declared', d);
    }
    // An evidence-backed uncertain reading is a soft under-declaration: a present-and-false hint is a
    // claim, not an absence, and a signal fired that declined to bound the level. Silence is not —
    // absence of evidence cannot accuse an explicit honest declaration.
    if (isUnknown && hasEvidence(d)) return raw(RULE.destructiveUnflagged, 'under-declared', d);
    return null; // read-only, additive, or reversibly-mutating tool honestly saying destructiveHint:false.
  }

  // 3. An explicit admission of destructiveness on a tool derived as a pure read: over-caution.
  if (destructive === 'explicit-true') {
    if (isRead && d.confidence !== 'uncertain') return raw(RULE.overDeclaredRisk, 'over-declared', d);
    return null; // admitting risk on a write, or on an uncertain reading, is the safe direction.
  }

  // 4. Fully silent (neither hint declared) on a tool derived as a destructive write. The spec
  //    default already prompts, so this is only an informational nudge to declare explicitly.
  if (isDestructiveWrite) return raw(RULE.destructiveAbsent, 'undeclared', d);
  return null;
}

// --- External reach aspect (hint: openWorldHint) ----------------------------------------------
function reachFinding(derived: ActionRiskProfile, declared: DeclaredProfile): RawFinding | null {
  const r = derived.externalReach;
  const level = r.level;
  const isOpen = level === 'open-world';
  const isLocal = level === 'local' || level === 'org-internal';
  const isUnknown = level === 'unknown';

  const openWorld = effectiveDeclaredValue(declared.openWorld, MCP_HINT_DEFAULTS.openWorld);

  if (openWorld === 'explicit-false') {
    // Derived open-world contradicts the local claim outright; an evidence-backed uncertain reading
    // is a soft contradiction. Silence cannot contradict an explicit honest claim (see hasEvidence)
    // — the commonest case for a local, honestly-annotated tool with no destination-shaped signal.
    if (isOpen || (isUnknown && hasEvidence(r)))
      return raw(RULE.externalReachUndeclared, 'under-declared', r);
    return null; // local tool honestly saying openWorldHint:false, or one we cannot prove reaches out.
  }
  if (openWorld === 'explicit-true') {
    if (isLocal && r.confidence !== 'uncertain') return raw(RULE.overDeclaredRisk, 'over-declared', r);
    return null;
  }
  // openWorldHint absent, derived open-world: the spec default covers it, so an informational nudge.
  if (isOpen) return raw(RULE.reachAbsent, 'undeclared', r);
  return null;
}

// --- Reversibility aspect (no MCP hint — supporting context only) ------------------------------
//
// MCP has no reversibility annotation, so this never invents a compliance failure against a
// protocol field (Invariant 4). It fires only in the distinct case of an irreversible action that
// is NOT an obvious destructive write and that the tool has not admitted is destructive — e.g. a
// payment or send. It is always a low, non-gating nudge to state the irreversible effect plainly.
function reversibilityFinding(derived: ActionRiskProfile, declared: DeclaredProfile): RawFinding | null {
  const rev = derived.reversibility;
  if (rev.level !== 'irreversible') return null;
  if (DESTRUCTIVE_WRITE_LEVELS.has(derived.destructiveness.level)) return null; // headline is the write.

  const destructive = effectiveDeclaredValue(declared.destructive, MCP_HINT_DEFAULTS.destructive);
  if (destructive === 'explicit-true') return null; // destructiveness already admitted.
  return raw(RULE.irreversibleUnflagged, 'undeclared', rev);
}

// At most one finding per RuleId per tool. Aspects are disjoint dimensions, so the only collision is
// over-declared-risk, which can be argued by both destructiveness and reach; keep the stronger
// (higher-confidence) one for a stable, non-duplicated result.
const CONFIDENCE_RANK: Record<Confidence, number> = { uncertain: 0, low: 1, medium: 2, high: 3 };

function dedupeByRuleId(findings: readonly RawFinding[]): readonly RawFinding[] {
  const strongest = new Map<string, RawFinding>();
  for (const f of findings) {
    const key = f.ruleId as string;
    const existing = strongest.get(key);
    if (existing === undefined || CONFIDENCE_RANK[f.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      strongest.set(key, f);
    }
  }
  return [...strongest.values()];
}

/**
 * Compare a derived profile against a declared profile and emit the honesty findings. Pure and
 * deterministic: the same inputs yield byte-identical output. Advisory (hygiene) findings are
 * derived separately from the schema shape (see ./advisories.ts); this function is honesty only.
 */
export function classify(derived: ActionRiskProfile, declared: DeclaredProfile): readonly RawFinding[] {
  const candidates = [
    destructivenessFinding(derived, declared),
    reachFinding(derived, declared),
    reversibilityFinding(derived, declared),
  ].filter((f): f is RawFinding => f !== null);

  return dedupeByRuleId(candidates);
}
