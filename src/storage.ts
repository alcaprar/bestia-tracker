import type { GameSession, Player, GameEvent, Transaction } from './types.js'

const STORAGE_KEY = 'bestia-game-session'

export class StorageService {
  static getSession(): GameSession | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null
      const session: GameSession = JSON.parse(data)

      // Ensure arrays are initialized
      if (!session.events) {
        session.events = []
      }

      // Convert metadata Maps back from JSON
      if (session.events) {
        session.events = session.events.map((event: any) => ({
          ...event,
          metadata: event.metadata ? {
            ...event.metadata,
            prese: event.metadata.prese ? new Map(event.metadata.prese) : undefined,
          } : undefined,
        }))
      }

      return session
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return null
    }
  }

  static saveSession(session: GameSession): void {
    try {
      session.updatedAt = Date.now()
      // Convert metadata Maps to arrays for JSON serialization
      const sessionToSave = {
        ...session,
        events: session.events.map((event) => ({
          ...event,
          metadata: event.metadata ? {
            ...event.metadata,
            prese: event.metadata.prese ? Array.from(event.metadata.prese.entries()) : undefined,
          } : undefined,
        })),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionToSave))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }

  static createNewSession(playerNames: string[], piatto: number = 0.3): GameSession {
    const players: Player[] = playerNames.map((name) => ({
      id: Math.random().toString(36).substr(2, 9),
      name,
      balance: 0,
      isActive: true,
    }))

    const session: GameSession = {
      id: Math.random().toString(36).substr(2, 9),
      piatto,
      players,
      currentDealerIndex: 0,
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.saveSession(session)
    return session
  }

  static recordRound(
    session: GameSession,
    preseMap: Map<string, number>,
    bestiaPlayerIds: string[]
  ): GameSession {
    const dealerPlayerId = session.players[session.currentDealerIndex].id
    const potAtStart = this.calculateCurrentPot(session)

    // Calculate payouts
    const payouts = new Map<string, number>()
    session.players.forEach((player) => {
      payouts.set(player.id, 0)
    })

    // Get winners (players with prese > 0)
    const winners = Array.from(preseMap.entries()).filter(([_, prese]) => prese > 0)
    const totalPrese = winners.reduce((sum, [_, prese]) => sum + prese, 0)

    if (bestiaPlayerIds.length > 0) {
      // Some players went bestia
      // Split pot among winners proportionally by prese
      winners.forEach(([playerId, prese]) => {
        const share = (prese / totalPrese) * potAtStart
        payouts.set(playerId, (payouts.get(playerId) || 0) + share)
      })

      // Bestia players pay the pot amount
      bestiaPlayerIds.forEach((playerId) => {
        payouts.set(playerId, (payouts.get(playerId) || 0) - potAtStart)
      })
    } else {
      // No bestia: winners split pot
      winners.forEach(([playerId, prese]) => {
        const share = (prese / totalPrese) * potAtStart
        payouts.set(playerId, (payouts.get(playerId) || 0) + share)
      })
    }

    // Create transactions array
    const transactions: Transaction[] = Array.from(payouts.entries())
      .filter(([_, amount]) => amount !== 0)
      .map(([playerId, amount]) => ({
        playerId,
        amount,
      }))

    // Record round_end event
    const event: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'round_end',
      timestamp: Date.now(),
      transactions,
      metadata: {
        dealerPlayerId,
        prese: preseMap,
        bestiaPlayers: bestiaPlayerIds,
      },
    }

    session.events.push(event)

    // Rotate dealer
    session.currentDealerIndex = (session.currentDealerIndex + 1) % session.players.length

    this.saveSession(session)
    return session
  }

  static recordDealerSelection(session: GameSession, dealerPlayerId: string): GameSession {
    const dealer = session.players.find((p) => p.id === dealerPlayerId)
    if (!dealer) return session

    // Find the new dealer's index
    const dealerIndex = session.players.findIndex((p) => p.id === dealerPlayerId)
    if (dealerIndex === -1) return session

    // Update current dealer
    session.currentDealerIndex = dealerIndex

    // Dealer puts in the ante
    const transactions: Transaction[] = [
      {
        playerId: dealerPlayerId,
        amount: -session.piatto,
      },
    ]

    const event: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'dealer_pay',
      timestamp: Date.now(),
      transactions,
      metadata: {
        dealerPlayerId,
      },
    }

    session.events.push(event)

    this.saveSession(session)
    return session
  }

  static recordGiroChiuso(session: GameSession): GameSession {
    const dealerPlayerId = session.players[session.currentDealerIndex].id

    // All players pay the basic piatto amount
    const transactions: Transaction[] = session.players.map((player) => ({
      playerId: player.id,
      amount: -session.piatto,
    }))

    const event: GameEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'giro_chiuso',
      timestamp: Date.now(),
      transactions,
      metadata: {
        dealerPlayerId,
      },
    }

    session.events.push(event)

    // Rotate dealer
    session.currentDealerIndex = (session.currentDealerIndex + 1) % session.players.length

    this.saveSession(session)
    return session
  }

  static calculateCurrentPot(session: GameSession): number {
    // Pot is the negative sum of all transactions
    // (payments are negative, so summing them gives us the pot amount)
    let totalTransactions = 0

    for (const event of session.events) {
      for (const transaction of event.transactions) {
        totalTransactions += transaction.amount
      }
    }

    // Negate because payments are negative
    return -totalTransactions
  }

  static calculatePlayerBalances(session: GameSession): Map<string, number> {
    const balances = new Map<string, number>()

    // Initialize all players with 0 balance
    session.players.forEach((player) => {
      balances.set(player.id, 0)
    })

    // Replay events to calculate balances
    for (const event of session.events) {
      event.transactions.forEach(({ playerId, amount }) => {
        balances.set(playerId, (balances.get(playerId) || 0) + amount)
      })
    }

    return balances
  }

  static getCurrentDealerId(session: GameSession): string {
    // Find the most recent dealer_pay event
    for (let i = session.events.length - 1; i >= 0; i--) {
      const event = session.events[i]
      if (event.type === 'dealer_pay') {
        return event.metadata?.dealerPlayerId || session.players[0].id
      }
    }
    // If no dealer events, return first player
    return session.players[0].id
  }

  static getNextDealerId(session: GameSession): string {
    // Get the current dealer
    const currentDealerId = this.getCurrentDealerId(session)
    const currentDealerIndex = session.players.findIndex((p) => p.id === currentDealerId)

    // Return the next player in order
    const nextIndex = (currentDealerIndex + 1) % session.players.length
    return session.players[nextIndex].id
  }

  static updatePiatto(session: GameSession, newPiatto: number): GameSession {
    session.piatto = newPiatto
    this.saveSession(session)
    return session
  }

  static updatePlayerOrder(session: GameSession, playerIds: string[]): GameSession {
    // Reorder players based on the new order
    const playerMap = new Map(session.players.map((p) => [p.id, p]))
    session.players = playerIds.map((id) => playerMap.get(id)!).filter(Boolean)
    this.saveSession(session)
    return session
  }

  static addPlayer(session: GameSession, playerName: string): GameSession {
    // Add a new active player
    const newPlayer: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: playerName,
      balance: 0,
      isActive: true,
    }
    // Create a new array to trigger reactivity
    session.players = [...session.players, newPlayer]
    this.saveSession(session)
    return session
  }

  static togglePlayerActive(session: GameSession, playerId: string, isActive: boolean): GameSession {
    // Create a new array with updated player to trigger reactivity
    session.players = session.players.map((p) =>
      p.id === playerId ? { ...p, isActive } : p
    )
    this.saveSession(session)
    return session
  }

  static getBalanceProgression(session: GameSession, playerId: string): { timestamp: number; balance: number }[] {
    const progression: { timestamp: number; balance: number }[] = []
    let balance = 0

    // Replay events in chronological order
    for (const event of session.events) {
      const transaction = event.transactions.find((t) => t.playerId === playerId)
      if (transaction) {
        balance += transaction.amount
        progression.push({ timestamp: event.timestamp, balance })
      }
    }

    return progression
  }

  static getBestiaCount(session: GameSession): Map<string, number> {
    const bestiaCount = new Map<string, number>()

    // Initialize all players with 0
    session.players.forEach((player) => {
      bestiaCount.set(player.id, 0)
    })

    // Count bestia occurrences
    for (const event of session.events) {
      if (event.type === 'round_end' && event.metadata?.bestiaPlayers) {
        event.metadata.bestiaPlayers.forEach((playerId) => {
          bestiaCount.set(playerId, (bestiaCount.get(playerId) || 0) + 1)
        })
      }
    }

    return bestiaCount
  }

  static getRoundStats(session: GameSession): { roundNumber: number; timestamp: number; winner: string; winnerName: string }[] {
    const rounds: { roundNumber: number; timestamp: number; winner: string; winnerName: string }[] = []
    let roundNumber = 0

    for (const event of session.events) {
      if (event.type === 'round_end') {
        roundNumber++
        // Find the player with the most prese (winner)
        const preseMap = event.metadata?.prese ? new Map(event.metadata.prese) : new Map()
        let maxPrese = 0
        let winnerId = ''

        for (const [pid, prese] of preseMap.entries()) {
          if (prese > maxPrese) {
            maxPrese = prese
            winnerId = pid
          }
        }

        const winnerName = session.players.find((p) => p.id === winnerId)?.name || 'Unknown'
        rounds.push({ roundNumber, timestamp: event.timestamp, winner: winnerId, winnerName })
      }
    }

    return rounds
  }

  static getPlayerWins(session: GameSession): Map<string, number> {
    const wins = new Map<string, number>()

    // Initialize all players with 0
    session.players.forEach((player) => {
      wins.set(player.id, 0)
    })

    // Count round_end events where player has positive transaction (won money)
    for (const event of session.events) {
      if (event.type === 'round_end') {
        event.transactions.forEach(({ playerId, amount }) => {
          if (amount > 0) {
            wins.set(playerId, (wins.get(playerId) || 0) + 1)
          }
        })
      }
    }

    return wins
  }

  static getPlayerRoundsPlayed(session: GameSession): Map<string, number> {
    const roundsPlayed = new Map<string, number>()

    // Initialize all players with 0
    session.players.forEach((player) => {
      roundsPlayed.set(player.id, 0)
    })

    // Count round_end events where player has any transaction
    for (const event of session.events) {
      if (event.type === 'round_end') {
        event.transactions.forEach(({ playerId }) => {
          roundsPlayed.set(playerId, (roundsPlayed.get(playerId) || 0) + 1)
        })
      }
    }

    return roundsPlayed
  }

  static getPlayerLosses(session: GameSession): Map<string, number> {
    const losses = new Map<string, number>()

    // Initialize all players with 0
    session.players.forEach((player) => {
      losses.set(player.id, 0)
    })

    // Count round_end events where player has negative transaction (lost money)
    for (const event of session.events) {
      if (event.type === 'round_end') {
        event.transactions.forEach(({ playerId, amount }) => {
          if (amount < 0) {
            losses.set(playerId, (losses.get(playerId) || 0) + 1)
          }
        })
      }
    }

    return losses
  }

  static clearSession(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}
