import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GameEvent, Player } from '../types.js'

@customElement('game-history')
export class GameHistory extends LitElement {
  @property({ type: Array })
  events: GameEvent[] = []

  @property({ type: Array })
  players: Player[] = []

  @property({ type: String })
  currency: string = '€'

  private formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  private getEventLabel(event: GameEvent): string {
    if (event.type === 'round_end') {
      const bestiaCount = event.metadata?.bestiaPlayers?.length || 0
      return bestiaCount > 0 ? `Giro (bestia x${bestiaCount})` : 'Giro'
    } else if (event.type === 'giro_chiuso') {
      return 'Giro Chiuso'
    } else if (event.type === 'dealer_pay') {
      return 'Piatto Mazziere'
    } else if (event.type === 'manual_entry') {
      return 'Inserimento Manuale'
    }
    return event.type
  }

  private deleteEvent(eventId: string): void {
    if (confirm('Eliminare questo evento?')) {
      this.dispatchEvent(
        new CustomEvent('delete-event', {
          detail: { eventId },
        })
      )
    }
  }

  render() {
    if (this.events.length === 0) {
      return html` <div class="empty-state">Nessun evento registrato</div> `
    }

    // Reverse to show most recent first
    const displayEvents = [...this.events].reverse()

    return html`
      <div class="ledger-container">
        <table class="ledger-table">
          <thead>
            <tr>
              <th class="event-col">Evento</th>
              <th class="time-col">Ora</th>
              ${this.players.map((player) => html`<th class="player-col">${player.name}</th>`)}
              <th class="delete-col"></th>
            </tr>
          </thead>
          <tbody>
            ${displayEvents.map(
              (event) => html`
                <tr class="event-row ${event.type}">
                  <td class="event-col">${this.getEventLabel(event)}</td>
                  <td class="time-col">${this.formatTime(event.timestamp)}</td>
                  ${this.players.map(
                    (player) => html`
                      <td class="player-col ${this.getAmountClass(event, player.id)}">
                        ${this.getAmount(event, player.id)}
                      </td>
                    `
                  )}
                  <td class="delete-col">
                    <button class="delete-btn" @click=${() => this.deleteEvent(event.id)} title="Delete event">✕</button>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `
  }

  private getAmount(event: GameEvent, playerId: string): string {
    const transaction = event.transactions.find((t) => t.playerId === playerId)
    if (!transaction) return '—'
    const amount = transaction.amount
    const sign = amount > 0 ? '+' : ''
    return `${sign}${this.currency}${Math.abs(amount).toFixed(2)}`
  }

  private getAmountClass(event: GameEvent, playerId: string): string {
    const transaction = event.transactions.find((t) => t.playerId === playerId)
    if (!transaction) return ''
    if (transaction.amount > 0) return 'win'
    if (transaction.amount < 0) return 'loss'
    return ''
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .ledger-container {
      padding: 1.5rem;
      overflow-x: auto;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--gray-700);
      font-size: 1.125rem;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      font-size: 0.875rem;
    }

    thead {
      background: var(--gray-100);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    th {
      padding: 0.75rem;
      text-align: left;
      font-weight: 700;
      color: var(--gray-700);
      border-bottom: 2px solid var(--gray-200);
      white-space: nowrap;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--gray-200);
      color: var(--gray-900);
    }

    tbody tr:hover {
      background: var(--gray-50);
    }

    .event-col {
      font-weight: 600;
      width: 140px;
      color: var(--primary);
    }

    .time-col {
      font-size: 0.8rem;
      color: var(--gray-700);
      width: 70px;
    }

    .player-col {
      text-align: right;
      font-family: 'Monaco', 'Courier New', monospace;
      font-weight: 500;
      min-width: 90px;
    }

    .player-col.win {
      color: #15803d;
      background: #f0fdf4;
    }

    .player-col.loss {
      color: #991b1b;
      background: #fef2f2;
    }

    .event-row.round_end .event-col {
      font-weight: 700;
    }

    .event-row.giro_chiuso .event-col {
      color: #ea580c;
      font-weight: 700;
    }

    .event-row.manual_entry .event-col {
      color: #8b5cf6;
      font-weight: 700;
    }

    .delete-col {
      width: 40px;
      text-align: center;
      padding: 0.5rem;
    }

    .delete-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--gray-700);
      cursor: pointer;
      font-size: 1.2rem;
      border-radius: 0.375rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .delete-btn:hover {
      background: var(--danger);
      color: white;
    }

    @media (max-width: 1024px) {
      .ledger-container {
        padding: 1rem;
      }

      th,
      td {
        padding: 0.5rem;
      }

      .ledger-table {
        font-size: 0.8rem;
      }

      th {
        font-size: 0.75rem;
      }
    }

    @media (max-width: 640px) {
      .ledger-container {
        padding: 0.75rem;
        overflow-x: auto;
      }

      th,
      td {
        padding: 0.5rem 0.375rem;
      }

      .ledger-table {
        font-size: 0.75rem;
      }

      th {
        font-size: 0.7rem;
      }

      .event-col {
        width: auto;
        font-size: 0.7rem;
      }

      .player-col {
        min-width: 70px;
        font-size: 0.7rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'game-history': GameHistory
  }
}
