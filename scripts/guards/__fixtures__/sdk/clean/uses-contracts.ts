// Fixture: a clean module that depends on the shared manifest types, not the SDK.
import type { CONTRACTS_SURFACE } from '@formael/actlint-core/contracts';

export type Surface = typeof CONTRACTS_SURFACE;
