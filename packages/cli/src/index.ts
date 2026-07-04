#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// actlint — the imperative shell.
// It is the ONLY place effects live: fetch, read file, print, map a final Outcome to one of
// the four public exit codes. It contains NO scoring logic — that is core's job.
export const CLI_PACKAGE = 'actlint';
