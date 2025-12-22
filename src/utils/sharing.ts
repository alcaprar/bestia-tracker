import type { GameSession } from '../types.js'

/**
 * Encodes a game session to a base64 string for sharing via URL
 */
export function encodeGameForSharing(session: GameSession): string {
  const sessionData = {
    ...session,
    events: session.events.map((event) => ({
      ...event,
      metadata: event.metadata
        ? {
            ...event.metadata,
            prese: event.metadata.prese ? Array.from(event.metadata.prese.entries()) : undefined,
          }
        : undefined,
    })),
  }

  const jsonString = JSON.stringify(sessionData)
  return btoa(jsonString)
}

/**
 * Decodes a base64 string back to a game session
 */
export function decodeGameFromSharing(encodedData: string): GameSession | null {
  try {
    const jsonString = atob(encodedData)
    const sessionData = JSON.parse(jsonString)

    // Convert metadata Maps back from JSON
    const session: GameSession = {
      ...sessionData,
      events: sessionData.events
        ? sessionData.events.map((event: any) => ({
            ...event,
            metadata: event.metadata
              ? {
                  ...event.metadata,
                  prese: event.metadata.prese ? new Map(event.metadata.prese) : undefined,
                }
              : undefined,
          }))
        : [],
    }

    return session
  } catch (error) {
    console.error('Error decoding shared game:', error)
    return null
  }
}

/**
 * Generates the full share URL for a game
 */
export function getShareUrl(session: GameSession): string {
  const encoded = encodeGameForSharing(session)
  // Use import.meta.env.BASE_URL for correct base path (handles both local and GitHub Pages)
  const baseUrl = window.location.origin + import.meta.env.BASE_URL
  return `${baseUrl}?share=${encoded}`
}
