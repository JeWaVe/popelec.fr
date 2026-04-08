/**
 * CLI entrypoint for the supplier catalog import.
 *
 *   npm run import:supplier -- \
 *     --manifest manifests/suppliers/2026-04-nuomake.yaml \
 *     --source local --source-base ./nuomake \
 *     --dry-run
 */
import { getPayload } from 'payload'
import config from '../../payload.config'
import { loadManifestFromFile } from '@/lib/import/manifest'
import {
  fileSourceFromConfig,
  type FileSourceConfig,
} from '@/lib/import/sources'
import {
  ExchangeRateHostProvider,
  StaticFxRateProvider,
  type FxRateProvider,
} from '@/lib/import/fxRates'
import {
  DEFAULT_PRICING_POLICY,
  type PricingPolicy,
} from '@/lib/import/pricing'
import { runImport, type Logger } from '@/lib/import/runner'

interface CliArgs {
  manifest: string
  sourceKind: 'local' | 'seafile'
  sourceBase: string
  dryRun: boolean
  offline: boolean
  allowCreateCategories: boolean
  margin?: number
  landed?: number
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: Partial<CliArgs> = {
    sourceKind: 'local',
    dryRun: false,
    offline: false,
    allowCreateCategories: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = (): string => {
      const v = argv[i + 1]
      if (v === undefined) throw new Error(`missing value for ${a}`)
      i++
      return v
    }
    switch (a) {
      case '--manifest':
        args.manifest = next()
        break
      case '--source': {
        const v = next()
        if (v !== 'local' && v !== 'seafile') {
          throw new Error(`--source must be local|seafile (got ${v})`)
        }
        args.sourceKind = v
        break
      }
      case '--source-base':
        args.sourceBase = next()
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--offline':
        args.offline = true
        break
      case '--allow-create-categories':
        args.allowCreateCategories = true
        break
      case '--margin':
        args.margin = Number(next())
        break
      case '--landed':
        args.landed = Number(next())
        break
      case '-h':
      case '--help':
        printUsage()
        process.exit(0)
        break
      default:
        throw new Error(`unknown argument: ${a}`)
    }
  }

  if (!args.manifest) throw new Error('--manifest is required')
  if (!args.sourceBase) throw new Error('--source-base is required')

  return args as CliArgs
}

function printUsage(): void {
  console.log(
    [
      'Usage: import-supplier --manifest <path> --source-base <dir|libId> [options]',
      '',
      '  --manifest <path>         path to YAML manifest (required)',
      '  --source local|seafile    file source backend (default: local)',
      '  --source-base <path>      base dir (local) or library id (seafile)',
      '  --dry-run                 print actions without writing to DB',
      '  --offline                 skip live FX fetch, use static fallback',
      '  --allow-create-categories auto-create missing categories',
      '  --margin <number>         override default pricing margin (2.5)',
      '  --landed <number>         override default landed cost fraction (0.25)',
    ].join('\n'),
  )
}

const consoleLogger: Logger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    printUsage()
    process.exit(2)
  }

  const manifest = await loadManifestFromFile(args.manifest)
  consoleLogger.info(
    `[manifest] loaded ${args.manifest} — ${manifest.products.length} products from ${manifest.supplier.reference}`,
  )

  const fileSourceConfig: FileSourceConfig =
    args.sourceKind === 'local'
      ? { kind: 'local', baseDir: args.sourceBase }
      : { kind: 'seafile', libraryId: args.sourceBase }
  const fileSource = fileSourceFromConfig(fileSourceConfig)
  consoleLogger.info(`[source] ${fileSource.describe()}`)

  const fxProvider: FxRateProvider = args.offline
    ? new StaticFxRateProvider()
    : new ExchangeRateHostProvider()
  consoleLogger.info(`[fx] ${fxProvider.describe()}`)

  const policy: PricingPolicy = {
    landedCostFraction: args.landed ?? DEFAULT_PRICING_POLICY.landedCostFraction,
    margin: args.margin ?? DEFAULT_PRICING_POLICY.margin,
  }
  consoleLogger.info(
    `[policy] landedCostFraction=${policy.landedCostFraction}, margin=${policy.margin}`,
  )

  const payload = await getPayload({ config })

  const result = await runImport(payload, {
    manifest,
    fileSource,
    fxProvider,
    pricingPolicy: policy,
    dryRun: args.dryRun,
    allowCreateCategories: args.allowCreateCategories,
    logger: consoleLogger,
  })

  consoleLogger.info('')
  consoleLogger.info('=== Import summary ===')
  consoleLogger.info(`  created:       ${result.created}`)
  consoleLogger.info(`  updated:       ${result.updated}`)
  consoleLogger.info(`  skippedLocked: ${result.skippedLocked}`)
  consoleLogger.info(`  mediaUploaded: ${result.mediaUploaded}`)
  consoleLogger.info(`  mediaReused:   ${result.mediaReused}`)
  consoleLogger.info(`  errors:        ${result.errors.length}`)
  if (result.errors.length > 0) {
    consoleLogger.info('  ---')
    for (const e of result.errors) {
      consoleLogger.error(`  - ${e.sku}: ${e.message}`)
    }
  }
  consoleLogger.info(`  fx provider:   ${result.fxProviderName}`)
  consoleLogger.info(`  fx rates:      ${JSON.stringify(result.fxRates)}`)

  if (args.dryRun) {
    consoleLogger.info('(dry-run, no DB writes)')
  }

  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
