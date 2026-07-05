// SPDX-FileCopyrightText: 2026 Formael
// SPDX-License-Identifier: Apache-2.0

// The dispatcher — argv to a RunResult. It routes the four commands (version, help, explain, scan),
// loads the declarative config for a scan, and returns the exit code and text to write. It is the
// whole shell as a pure-of-process function: give it argv and effects, get back what to print and
// which code to exit with. index.ts is the only thing that actually touches the process.

import { parseArgv } from './args.ts';
import { loadConfig, resolveScan } from './config.ts';
import { type CliError, EXIT, exitCodeFor } from './exit-codes.ts';
import { renderExplain } from './explain.ts';
import { type RunContext, type RunResult, runScan } from './scan.ts';
import { USAGE } from './usage.ts';
import { formatVersions, versions } from './version.ts';

const HELP_HINT = 'Run `actlint --help` for usage.';

// A usage error is self-correcting: append the pointer to --help. An ingestion error already carries
// its own explanation, so it stands alone.
function errorResult(error: CliError): RunResult {
  const hint = error.kind === 'usage' ? `\n\n${HELP_HINT}` : '';
  return { exitCode: exitCodeFor(error), stdout: '', stderr: `actlint: ${error.message}${hint}\n` };
}

export async function run(argv: readonly string[], ctx: RunContext): Promise<RunResult> {
  const parsed = parseArgv(argv);
  if (!parsed.ok) return errorResult(parsed.error);

  const command = parsed.command;
  switch (command.kind) {
    case 'version':
      return { exitCode: EXIT.clean, stdout: `${formatVersions(versions())}\n`, stderr: '' };

    case 'help':
      return { exitCode: EXIT.clean, stdout: `${USAGE}\n`, stderr: '' };

    case 'explain': {
      const explained = renderExplain(command.ruleId);
      return explained.ok
        ? { exitCode: EXIT.clean, stdout: explained.text, stderr: '' }
        : errorResult(explained.error);
    }

    case 'scan': {
      const config = loadConfig(ctx.cwd);
      if (!config.ok) return errorResult(config.error);
      const resolved = resolveScan(command.flags, config.config);
      return runScan(resolved, ctx);
    }
  }
}
