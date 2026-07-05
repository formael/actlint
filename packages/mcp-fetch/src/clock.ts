// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The clock lives here, at the impure edge — never in the engine.
//
// `capturedAt` is provenance metadata only: the pure pipeline MUST NEVER read it, so a wall-clock
// read here cannot make a finding non-deterministic. Capture-and-replay pins the value into the
// manifest, and every downstream run is a pure function of the captured tools alone.

import { isoTimestampSchema } from '@formael/actlint-core/contracts';
import type { IsoTimestamp } from '@formael/actlint-core/contracts';

/** The current instant as a branded ISO-8601 timestamp, for manifest provenance only. */
export function nowIso(): IsoTimestamp {
  return isoTimestampSchema.parse(new Date().toISOString());
}
