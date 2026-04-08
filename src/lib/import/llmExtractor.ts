import { spawn } from 'node:child_process'
import {
  type ExtractedCandidate,
  type ExtractedPayload,
  parseExtractedPayload,
} from '@/lib/import/llmSchema'
import { type ScannedTree, formatTreeForPrompt } from '@/lib/import/seafileScanner'

/**
 * Abstraction over the LLM call so the runner is testable without spawning
 * a real Claude CLI process. Production uses {@link ClaudeCliExtractor};
 * tests inject {@link StubLlmExtractor}.
 */

export interface ExtractInput {
  readonly tree: ScannedTree
  readonly libraryName: string
  /** Optional list of allowed category slugs to constrain LLM output. */
  readonly allowedCategories?: readonly string[]
}

export interface LlmExtractor {
  extract(input: ExtractInput): Promise<readonly ExtractedCandidate[]>
  describe(): string
}

const SYSTEM_PROMPT = `You are an expert French industrial e-commerce buyer for "popelec.fr", a French shop selling Chinese-supplier electrical equipment (motors, frequency inverters, breakers, cabinets) to professionals and individuals.

You are given the file listing of a supplier library on Seafile. Your job is to extract a list of distinct product CANDIDATES from the file tree. For each candidate, output:

- proposedSku: a stable, machine-readable identifier. Prefer SKUs visible in filenames (e.g. "MC9001-2S0007G"). If none, derive a slug from the folder name. SKU regex: /^[A-Za-z0-9._-]{3,64}$/.
- proposedName: the product name in BOTH French (fr) and English (en). Be specific and technical: "Variateur de fréquence 0.75 kW monophasé" / "Single-phase frequency inverter 0.75 kW".
- proposedShortDescription: a 1–2 sentence pitch in BOTH languages.
- proposedCategorySlug: one slug, lowercase, dashes only. Examples: variateurs, moteurs, disjoncteurs, contacteurs, armoires, accessoires.
- proposedBrand: optional, e.g. "NUOMAKE".
- proposedSourceCurrency: USD by default for Chinese suppliers, unless filenames clearly indicate CNY or EUR.
- proposedSourceAmount: a positive number (the wholesale price the buyer pays). Make a reasonable guess from filenames or context if no explicit price is visible — small inverters are typically 50–150 USD.
- proposedSpecs: an array of {label:{fr,en}, value:{fr,en}, unit?, group?} with the technical specs you can infer (power, voltage, current, phase, IP rating, etc).
- proposedImagePaths: an array of {path, alt?} pointing to image files (.png/.jpg/.webp) that belong to this product. Use the EXACT paths from the file listing. At least one image is required.
- proposedDatasheetPaths: optional, PDFs that document the product.

Group files into candidates by coherent folder + filename patterns. One folder per product is the typical layout. If a folder contains many similar items, split them into separate candidates by their visible SKU prefix.

Only output valid JSON matching the schema. Do not include any explanation outside the JSON.`

export class StubLlmExtractor implements LlmExtractor {
  constructor(private readonly canned: readonly ExtractedCandidate[]) {}

  async extract(_input: ExtractInput): Promise<readonly ExtractedCandidate[]> {
    return this.canned
  }

  describe(): string {
    return `stub(${this.canned.length} candidates)`
  }
}

export interface ClaudeCliOptions {
  /** Path to the `claude` binary. Default: 'claude' (relies on PATH). */
  readonly binary?: string
  /** Maximum spend cap in USD passed to `--max-budget-usd`. Default 0.50. */
  readonly maxBudgetUsd?: number
  /** Hard timeout in ms for the CLI invocation. Default 120_000. */
  readonly timeoutMs?: number
  /** Override the default system prompt. */
  readonly systemPrompt?: string
}

export class ClaudeCliExtractor implements LlmExtractor {
  private readonly binary: string
  private readonly maxBudgetUsd: number
  private readonly timeoutMs: number
  private readonly systemPrompt: string

  constructor(opts: ClaudeCliOptions = {}) {
    this.binary = opts.binary ?? 'claude'
    this.maxBudgetUsd = opts.maxBudgetUsd ?? 0.5
    this.timeoutMs = opts.timeoutMs ?? 120_000
    this.systemPrompt = opts.systemPrompt ?? SYSTEM_PROMPT
  }

  async extract(input: ExtractInput): Promise<readonly ExtractedCandidate[]> {
    const userPrompt = this.buildUserPrompt(input)
    const { stdout } = await this.runCli(userPrompt)
    const json = this.extractJsonObject(stdout)
    const parsed = parseExtractedPayload(json)
    return parsed.candidates
  }

  describe(): string {
    return `claude-cli(${this.binary})`
  }

  private buildUserPrompt(input: ExtractInput): string {
    const lines: string[] = []
    lines.push(`Library name: ${input.libraryName}`)
    if (input.allowedCategories && input.allowedCategories.length > 0) {
      lines.push(`Allowed category slugs: ${input.allowedCategories.join(', ')}`)
    }
    lines.push('')
    lines.push(formatTreeForPrompt(input.tree))
    lines.push('')
    lines.push('Output a single JSON object with key "candidates" matching the schema. No prose.')
    return lines.join('\n')
  }

  private runCli(userPrompt: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p',
        '--output-format',
        'json',
        '--system-prompt',
        this.systemPrompt,
        '--max-budget-usd',
        String(this.maxBudgetUsd),
      ]
      const child = spawn(this.binary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        reject(new Error(`claude CLI timed out after ${this.timeoutMs}ms`))
      }, this.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      child.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error(`claude CLI failed to spawn: ${err.message}`))
      })
      child.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (code !== 0) {
          reject(
            new Error(
              `claude CLI exited with code ${code}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`,
            ),
          )
          return
        }
        resolve({ stdout, stderr })
      })

      child.stdin.write(userPrompt)
      child.stdin.end()
    })
  }

  /**
   * The CLI's JSON output mode wraps the model response in an envelope:
   *   { "type": "result", "result": "<text content>", ... }
   * The `result` field is the actual model response, which itself should
   * be a JSON object. We tolerate either shape.
   */
  private extractJsonObject(stdout: string): unknown {
    const trimmed = stdout.trim()
    if (trimmed === '') {
      throw new Error('claude CLI returned empty output')
    }
    let envelope: unknown
    try {
      envelope = JSON.parse(trimmed)
    } catch (err) {
      throw new Error(
        `claude CLI output is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      )
    }

    if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
      const obj = envelope as Record<string, unknown>
      if ('candidates' in obj) {
        return obj
      }
      if (typeof obj.result === 'string') {
        return parseInnerJson(obj.result)
      }
      if (typeof obj.result === 'object' && obj.result !== null) {
        return obj.result
      }
      // Some CLI versions emit { content: [...] } — fall through to error.
    }

    throw new Error('claude CLI response shape not recognized (no candidates / result field)')
  }
}

function parseInnerJson(text: string): unknown {
  const trimmed = text.trim()
  // Some models wrap JSON in ```json … ``` fences. Strip them.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(candidate)
  } catch (err) {
    throw new Error(
      `inner JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

export function expectedExtractedPayloadShape(): ExtractedPayload {
  // Tiny helper kept around so the type can be inspected from the REPL.
  return { candidates: [] }
}
