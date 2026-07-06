// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// Pre-publish precondition. The CLI is published as the unscoped npm name `actlint`; before the first
// publish we must confirm that name is still claimable (or already ours), and fall back to
// `mcp-actlint` / `@formael/actlint` rather than release under a name someone else owns. This is a
// tooling script — it touches the network on purpose and lives well outside the pure scoring path.
//
// Usage: `pnpm check-npm-name`. Exit 0 = safe to publish under the intended names; exit 1 = a name is
// taken by a different owner and the human name-decision is required first.

const REGISTRY = 'https://registry.npmjs.org';

// Owners we recognise as ours. A hit owned by one of these is fine; a hit owned by anyone else blocks.
const KNOWN_OWNERS = new Set(['formael']);

interface NameCheck {
  readonly name: string;
  readonly kind: 'cli' | 'vocabulary';
}

const NAMES: readonly NameCheck[] = [
  { name: 'actlint', kind: 'cli' },
  { name: '@formael/action-risk-vocabulary', kind: 'vocabulary' },
];

type Verdict =
  | { readonly status: 'claimable' }
  | { readonly status: 'ours'; readonly maintainers: readonly string[] }
  | { readonly status: 'taken'; readonly maintainers: readonly string[] }
  | { readonly status: 'error'; readonly detail: string };

async function inspect(name: string): Promise<Verdict> {
  let response: Response;
  try {
    response = await fetch(`${REGISTRY}/${encodeURIComponent(name).replaceAll('%40', '@')}`, {
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    return { status: 'error', detail: error instanceof Error ? error.message : String(error) };
  }

  if (response.status === 404) return { status: 'claimable' };
  if (!response.ok) return { status: 'error', detail: `registry returned ${response.status}` };

  const body = (await response.json()) as { maintainers?: ReadonlyArray<{ name?: string }> };
  const maintainers = (body.maintainers ?? []).map((m) => m.name ?? '').filter((n) => n.length > 0);
  const ours = maintainers.some((m) => KNOWN_OWNERS.has(m));
  return ours ? { status: 'ours', maintainers } : { status: 'taken', maintainers };
}

function fallbackHint(kind: NameCheck['kind']): string {
  return kind === 'cli'
    ? 'fall back to `mcp-actlint` or `@formael/actlint` before releasing'
    : 'choose an alternative scoped name before releasing';
}

async function main(): Promise<void> {
  let blocked = false;

  for (const { name, kind } of NAMES) {
    const verdict = await inspect(name);
    switch (verdict.status) {
      case 'claimable':
        console.log(`✓ ${name} — claimable (unregistered)`);
        break;
      case 'ours':
        console.log(`✓ ${name} — already ours (maintainers: ${verdict.maintainers.join(', ')})`);
        break;
      case 'taken':
        blocked = true;
        console.error(
          `✗ ${name} — owned by another publisher (${verdict.maintainers.join(', ')}); ${fallbackHint(kind)}`,
        );
        break;
      case 'error':
        blocked = true;
        console.error(`✗ ${name} — could not verify (${verdict.detail}); resolve before publishing`);
        break;
    }
  }

  if (blocked) {
    console.error('\nnpm name check failed — a human name-decision is required before the first publish.');
    process.exit(1);
  }
  console.log('\nAll intended npm names are safe to publish.');
}

void main();
