// Fixture: a clean pure module. No clock, network, fs, process, or randomness.
// Guards read this as text; it is never imported or type-checked.
export function classify(gap: number): 'consistent' | 'under-declared' {
  return gap === 0 ? 'consistent' : 'under-declared';
}
