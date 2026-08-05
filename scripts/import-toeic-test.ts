import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { normalizeToeicImport, sha256CanonicalJson } from '../features/toeic-tests/importer/normalize.ts';
import { verifyLocalMediaDirectory } from '../features/toeic-tests/importer/mediaVerification.ts';
import { validateRawToeicTestFile } from '../features/toeic-tests/importer/validate.ts';
import type {
  ImportValidationIssue,
  NormalizedToeicImport,
  ToeicImportReport,
} from '../features/toeic-tests/importer/types.ts';

interface ImportCliArgs {
  file: string | null;
  apply: boolean;
  replaceDraft: boolean;
  mediaDir: string | null;
  reportPath: string | null;
}

function parseArgs(argv: string[]): ImportCliArgs {
  const result: ImportCliArgs = {
    file: null,
    apply: false,
    replaceDraft: false,
    mediaDir: null,
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--apply') result.apply = true;
    else if (argument === '--dry-run') result.apply = false;
    else if (argument === '--replace-draft') result.replaceDraft = true;
    else if (argument === '--file' && next) { result.file = next; index += 1; }
    else if (argument === '--media-dir' && next) { result.mediaDir = next; index += 1; }
    else if (argument === '--report' && next) { result.reportPath = next; index += 1; }
    else if (argument === '--help' || argument === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!result.file) throw new Error('--file is required.');
  if (result.replaceDraft && !result.apply) throw new Error('--replace-draft requires --apply.');
  return result;
}

function printUsage(): void {
  console.log(`Usage:
  npm run toeic:import -- --file <path> [--dry-run]
  npm run toeic:import -- --file <path> --apply [--replace-draft]

Options:
  --file <path>       Source TOEIC JSON file (required)
  --dry-run           Validate and report only (default)
  --apply             Apply to local Supabase only
  --replace-draft     Replace an existing draft with no attempts
  --media-dir <path>  Verify local media files without reading file contents
  --report <path>     Write the typed import report to this path`);
}

function parseEnvLine(line: string): [string, string] | null {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

async function loadLocalEnvFiles(): Promise<void> {
  for (const filename of ['.env', '.env.local']) {
    try {
      const content = await readFile(path.resolve(process.cwd(), filename), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const parsed = parseEnvLine(line);
        if (parsed && process.env[parsed[0]] === undefined) process.env[parsed[0]] = parsed[1];
      }
    } catch {
      // Optional env files are not required for dry-run.
    }
  }
}

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function addIssue(
  issues: ImportValidationIssue[],
  severity: 'warning' | 'error',
  code: string,
  pathValue: string,
  message: string
): void {
  issues.push({ severity, code, path: pathValue, message });
}

function getReportPath(args: ImportCliArgs, testId: string): string {
  return path.resolve(args.reportPath ?? path.join('reports', 'toeic', `${testId}-import-report.json`));
}

function buildReport(
  mode: 'dry-run' | 'apply',
  inputFilename: string,
  normalized: NormalizedToeicImport,
  mediaVerification: ToeicImportReport['mediaVerification']
): ToeicImportReport {
  return {
    mode,
    testId: normalized.test.id,
    sourceHash: normalized.sourceHash,
    inputFilename,
    counts: {
      questions: normalized.questions.length,
      passages: normalized.passages.length,
      answerKeys: normalized.answerKeys.length,
      audioObjects: normalized.mediaManifest.filter((entry) => entry.kind === 'audio').length,
      imageObjects: normalized.mediaManifest.filter((entry) => entry.kind === 'image').length,
    },
    warnings: normalized.warnings,
    errors: normalized.errors,
    mediaVerification,
    databaseApplied: false,
    databaseResult: null,
    generatedAt: new Date().toISOString(),
  };
}

async function writeOutputs(
  reportPath: string,
  report: ToeicImportReport,
  normalized: NormalizedToeicImport
): Promise<string> {
  const outputDirectory = path.dirname(reportPath);
  await mkdir(outputDirectory, { recursive: true });
  const manifestPath = path.join(outputDirectory, `${normalized.test.id}-media-manifest.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(manifestPath, `${JSON.stringify(normalized.mediaManifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function applyNormalizedImport(normalized: NormalizedToeicImport, replaceDraft: boolean): Promise<NonNullable<ToeicImportReport['databaseResult']>> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^("|')|("|')$/g, '');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Apply requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!isLocalSupabaseUrl(supabaseUrl)) {
    throw new Error('Apply is blocked unless SUPABASE_URL targets localhost, 127.0.0.1 or ::1.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc('import_toeic_test', {
    p_test: normalized.test,
    p_passages: normalized.passages,
    p_questions: normalized.questions,
    p_answer_keys: normalized.answerKeys,
    p_replace_draft: replaceDraft,
  });
  if (error) throw new Error(`Database import failed: ${error.message}`);
  if (!isObject(data) || data.status !== 'success' || !isObject(data.counts)) {
    throw new Error('Database import returned an invalid result.');
  }

  const counts = data.counts;
  if (typeof counts.questions !== 'number' || typeof counts.passages !== 'number' || typeof counts.answer_keys !== 'number') {
    throw new Error('Database import result did not contain verified counts.');
  }
  return {
    replacedDraft: data.replaced_draft === true,
    counts: { questions: counts.questions, passages: counts.passages, answerKeys: counts.answer_keys },
  };
}

async function main(): Promise<void> {
  await loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.file as string);
  const inputFilename = path.basename(inputPath);
  const inputText = await readFile(inputPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(inputText) as unknown;
  } catch {
    throw new Error(`Invalid JSON: ${inputFilename}`);
  }

  const validation = validateRawToeicTestFile(parsed);
  if (!validation.value) {
    throw new Error(`Validation failed with ${validation.errors.length} error(s).`);
  }
  const normalized = normalizeToeicImport(
    validation.value,
    validation.warnings,
    validation.errors,
    sha256CanonicalJson(parsed)
  );

  let mediaVerification: ToeicImportReport['mediaVerification'] = null;
  if (args.mediaDir) {
    try {
      const result = await verifyLocalMediaDirectory(normalized.mediaManifest, path.resolve(args.mediaDir), args.apply);
      mediaVerification = result.summary;
      normalized.warnings.push(...result.issues.filter((issue) => issue.severity === 'warning'));
      normalized.errors.push(...result.issues.filter((issue) => issue.severity === 'error'));
    } catch (error) {
      addIssue(normalized.errors, 'error', 'media_directory_error', args.mediaDir, error instanceof Error ? error.message : 'Could not inspect media directory.');
    }
  }

  const mode = args.apply ? 'apply' : 'dry-run';
  const reportPath = getReportPath(args, normalized.test.id);
  let report = buildReport(mode, inputFilename, normalized, mediaVerification);
  let manifestPath = await writeOutputs(reportPath, report, normalized);

  if (normalized.errors.length > 0) {
    console.error(`TOEIC ${mode} failed validation with ${normalized.errors.length} error(s).`);
    console.error(`Report: ${reportPath}`);
    console.error(`Manifest: ${manifestPath}`);
    process.exitCode = 1;
    return;
  }

  if (args.apply) {
    try {
      const databaseResult = await applyNormalizedImport(normalized, args.replaceDraft);
      report.databaseApplied = true;
      report.databaseResult = databaseResult;
      report.warnings = normalized.warnings;
      report.errors = normalized.errors;
      report = { ...report, generatedAt: new Date().toISOString() };
      manifestPath = await writeOutputs(reportPath, report, normalized);
    } catch (error) {
      addIssue(normalized.errors, 'error', 'database_apply_failed', 'database', error instanceof Error ? error.message : 'Database apply failed.');
      report.errors = normalized.errors;
      report = { ...report, generatedAt: new Date().toISOString() };
      manifestPath = await writeOutputs(reportPath, report, normalized);
      console.error('TOEIC apply failed; the database RPC transaction was rolled back.');
      console.error(`Report: ${reportPath}`);
      console.error(`Manifest: ${manifestPath}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`TOEIC ${mode} complete: ${normalized.questions.length} questions, ${normalized.passages.length} passages, ${normalized.answerKeys.length} answer keys.`);
  console.log(`Warnings: ${normalized.warnings.length}; errors: ${normalized.errors.length}; sourceHash: ${normalized.sourceHash}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'TOEIC importer failed.');
  process.exitCode = 1;
});
