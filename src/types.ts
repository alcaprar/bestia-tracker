/**
 * Data types for Bestia card game tracking
 */

export type EventType = 'dealer_pay' | 'round_end' | 'giro_chiuso' | 'manual_entry'

export interface Transaction {
  playerId: string
  amount: number
}

export interface GameEvent {
  id: string
  type: EventType
  timestamp: number
  transactions: Transaction[]
  metadata?: {
    dealerPlayerId?: string
    prese?: Map<string, number>
    bestiaPlayers?: string[]
    description?: string
  }
}

export interface Player {
  id: string
  name: string
  balance: number
  isActive: boolean
}

export interface GameSession {
  id: string
  piatto: number // ante amount
  players: Player[]
  currentDealerIndex: number
  events: GameEvent[]
  createdAt: number
  updatedAt: number
  currency?: string // currency symbol (defaults to '€' if undefined)
}
