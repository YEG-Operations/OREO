/**
 * Zod validation layer for AI (Qwen) generated proposals.
 *
 * - ProposalSchema:       shape of a single proposal coming from the AI.
 * - GenerateProposalsSchema: full payload for /api/genera-proposte.
 * - SingleCategorySchema: payload for /api/cerca-proposta.
 * - parseProposalsPayload(raw): validates and strips unknown fields.
 * - normalizeProposal(p):  coerces arrays, flags AI-sourced contact data as
 *                          `da_verificare: true`, sets `email_verified: null`.
 */

import { z } from 'zod'

export const CATEGORIA_ENUM = [
  'hotel',
  'location',
  'catering',
  'dmc',
  'teambuilding',
  'ristoranti',
  'allestimenti',
  'entertainment',
  'trasporti',
] as const

export const FONTE_ENUM = ['ai', 'yeg_db', 'web', 'manager'] as const

/** Single proposal — shape expected from Qwen output. */
export const ProposalSchema = z
  .object({
    nome: z.string().min(1, 'nome must be non-empty'),
    categoria: z.enum(CATEGORIA_ENUM).optional(),
    descrizione: z.string().optional(),
    motivo_match: z.string().optional(),
    prezzo_stimato: z.number().nullable().optional(),
    capacita: z.string().optional(),
    indirizzo: z.string().optional(),
    pro: z.array(z.string()).default([]),
    contro: z.array(z.string()).default([]),
    adeguatezza_budget: z.number().min(0).max(100).nullable().optional(),
    note: z.string().optional(),
    sito_web: z.string().optional(),
    contatto: z.string().optional(),
    is_yeg_supplier: z.boolean().default(false),
    fonte: z.enum(FONTE_ENUM).default('ai'),
  })
  .strip()

export type Proposal = z.infer<typeof ProposalSchema>

/** Per-category block: { proposte: [...] }. */
export const CategoryBlockSchema = z
  .object({
    proposte: z.array(ProposalSchema).default([]),
  })
  .strip()

/** Brief interpretato is free-form; we keep it permissive. */
export const BriefInterpretatoSchema = z
  .object({
    sintesi: z.string().optional(),
    obiettivi_evento: z.string().optional(),
    tono_evento: z.string().optional(),
    priorita: z.array(z.string()).optional(),
    suggerimenti_ai: z.string().optional(),
  })
  .passthrough()

/** Full payload for /api/genera-proposte. */
export const GenerateProposalsSchema = z
  .object({
    brief_interpretato: BriefInterpretatoSchema.optional(),
    categorie: z.record(z.string(), CategoryBlockSchema),
  })
  .strip()

export type GenerateProposalsPayload = z.infer<typeof GenerateProposalsSchema>

/** Payload for /api/cerca-proposta. */
export const SingleCategorySchema = z
  .object({
    proposte: z.array(ProposalSchema).default([]),
  })
  .strip()

export type SingleCategoryPayload = z.infer<typeof SingleCategorySchema>

/**
 * Validate + strip unknown fields. Throws z.ZodError on failure.
 * Useful when we want the full parsed payload object.
 */
export function parseProposalsPayload(raw: unknown): GenerateProposalsPayload {
  return GenerateProposalsSchema.parse(raw)
}

/**
 * Normalize a single proposal before DB insert:
 *  - Ensure pro/contro are arrays of strings.
 *  - If fonte === 'ai' AND (contatto OR sito_web) present → da_verificare = true.
 *    (AI contact data is unverified by definition.)
 *  - email_verified: null (unknown until manual/automated check).
 */
export function normalizeProposal(
  p: Proposal
): Proposal & { da_verificare: boolean; email_verified: null } {
  const pro = Array.isArray(p.pro)
    ? p.pro.filter((x) => typeof x === 'string' && x.length > 0)
    : []
  const contro = Array.isArray(p.contro)
    ? p.contro.filter((x) => typeof x === 'string' && x.length > 0)
    : []

  const fonte = p.fonte ?? 'ai'
  const hasContact = Boolean(
    (p.contatto && p.contatto.trim()) || (p.sito_web && p.sito_web.trim())
  )
  const daVerificare = fonte === 'ai' && hasContact

  return {
    ...p,
    pro,
    contro,
    fonte,
    is_yeg_supplier: p.is_yeg_supplier ?? false,
    da_verificare: daVerificare,
    email_verified: null,
  }
}
