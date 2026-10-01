// Types for src/lib/term-pricing-settings.js, for the React screen.
import type { EngineParamsInput } from './term-pricing'

export const SETTING_KEYS: string[]
export const PER_PRODUCT_KEYS: string[]
export interface CatalogCost { hwCost: string; hostingMonthly: string; batchLabel: string; effectiveFrom: string }
export function settingsFromRows(rows: Array<{ key: string; value: unknown }>): Record<string, unknown>
export function costsFromCatalog(current: unknown[], rawRows: unknown[]): Record<string, CatalogCost>
export function buildParams(settings: Record<string, unknown>, costs: Record<string, CatalogCost>): EngineParamsInput
export function mergeSettingsChange(current: Record<string, unknown>, patch: unknown, costs: Record<string, CatalogCost>): Record<string, unknown>
