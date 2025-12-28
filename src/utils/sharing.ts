import pako from 'pako';
import type { GameSession } from '../types.js';

/**
 * Encodes a game session to a compressed base64 string for sharing via URL
 * Uses gzip compression to significantly reduce data size
 * Returns URL-safe base64 encoding
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
  };

  const jsonString = JSON.stringify(sessionData);

  // Compress with gzip
  const compressed = pako.gzip(jsonString);

  // Convert to base64
  const binaryString = String.fromCharCode.apply(null, Array.from(compressed));
  const base64 = btoa(binaryString);

  // Convert to URL-safe base64 (replace + with -, / with _, remove padding =)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes a compressed base64 string back to a game session
 */
export function decodeGameFromSharing(encodedData: string): GameSession | null {
  try {
    // Convert URL-safe base64 back to standard base64
    // Replace - with +, _ with /, and add padding back
    let base64 = encodedData.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);

    // Decode base64
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress gzip
    const decompressed = pako.ungzip(bytes, { to: 'string' });
    const sessionData = JSON.parse(decompressed);

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
    };

    return session;
  } catch (error) {
    console.error('Error decoding shared game:', error);
    return null;
  }
}

/**
 * Generates the full share URL for a game
 */
export function getShareUrl(session: GameSession): string {
  const encoded = encodeGameForSharing(session);
  // Use import.meta.env.BASE_URL for correct base path (handles both local and GitHub Pages)
  const baseUrl = window.location.origin + import.meta.env.BASE_URL;
  return `${baseUrl}?share=${encoded}`;
}
