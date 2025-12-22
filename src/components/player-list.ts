import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { Player } from '../types.js'

@customElement('player-list')
export class PlayerList extends LitElement {
  @property({ type: Array })
  players: Player[] = []

  @property({ type: Map })
  balances: Map<string, number> = new Map()

  @property({ type: String })
  currency: string = '€'

  render() {
    // Sort players by balance (highest first)
    const sortedPlayers = [...this.players].sort((a, b) => {
      const aBalance = this.balances.get(a.id) ?? a.balance
      const bBalance = this.balances.get(b.id) ?? b.balance
      return bBalance - aBalance
    })

    return html`
      <div class="players-grid">
        ${sortedPlayers.map(
          (player) => {
            const balance = this.balances.get(player.id) ?? player.balance
            return html`
              <div class="player-card ${balance > 0 ? 'winning' : balance < 0 ? 'losing' : ''}">
                <div class="player-name">${player.name}</div>
                <div class="player-stats">
                  <span class="stat-value">${this.currency}${balance.toFixed(2)}</span>
                </div>
              </div>
            `
          }
        )}
      </div>
    `
  }

  static styles = css`
    :host {
      --success: #10b981;
      --danger: #ef4444;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .players-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .player-card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border-left: 4px solid var(--gray-200);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .player-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .player-card.winning {
      border-left-color: var(--success);
      background: #f0fdf4;
    }

    .player-card.losing {
      border-left-color: var(--danger);
      background: #fef2f2;
    }

    .player-name {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 1rem;
      word-break: break-word;
    }

    .player-stats {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
    }

    @media (max-width: 640px) {
      .players-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }

      .player-card {
        padding: 1rem;
      }

      .player-name {
        font-size: 1rem;
        margin-bottom: 0.75rem;
      }

      .stat-value {
        font-size: 0.875rem;
      }

      .stat-value-small {
        font-size: 0.875rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'player-list': PlayerList
  }
}
