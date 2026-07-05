// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// CI entry. Fails the build if the vocabulary data package grows implementation — any exported
// function beyond its validators, or any internal import. Run via `pnpm guard:vocabulary`.

import { reportGuard } from './guards/report';
import { VOCABULARY_ROOT, checkVocabularyData } from './guards/vocabulary-data';

process.exit(reportGuard('check-vocabulary-data', checkVocabularyData([VOCABULARY_ROOT])));
