import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Player } from '../types.js'

@customElement('game-input')
export class GameInput extends LitElement {
  @property({ type: Array })
  players: Player[] = []

  @property({ type: Number })
  piatto: number = 0

  @property({ type: Number })
  currentPot: number = 0

  @property({ type: String })
  dealer: string = ''

  @property({ type: String })
  currency: string = '€'

  @state()
  private playerSelection: Map<string, 'none' | '1' | '2' | '3' | 'bestia'> = new Map()

  connectedCallback() {
    super.connectedCallback()
    // Initialize all active players with no selection
    this.players.forEach((player) => {
      if (player.isActive) {
        this.playerSelection.set(player.id, 'none')
      }
    })
  }

  private setPlayerSelection(playerId: string, selection: 'none' | '1' | '2' | '3' | 'bestia'): void {
    this.playerSelection.set(playerId, selection)
    this.requestUpdate()
  }

  private calculatePayouts(): Map<string, number> {
    const payouts = new Map<string, number>()
    const potAmount = this.currentPot
    const TOTAL_PRESE = 3 // Game always has exactly 3 prese

    // Initialize all players with 0 payout
    this.players.forEach((player) => {
      payouts.set(player.id, 0)
    })

    // Get bestia players and prese conversion (only from active players)
    const preseMap = new Map<string, number>()
    const bestiaPlayers: string[] = []

    this.players.forEach((player) => {
      if (player.isActive) {
        const selection = this.playerSelection.get(player.id) || 'none'
        if (selection === 'bestia') {
          bestiaPlayers.push(player.id)
          preseMap.set(player.id, 0)
        } else if (selection === 'none') {
          preseMap.set(player.id, 0)
        } else {
          preseMap.set(player.id, parseInt(selection))
        }
      }
    })

    // Get winners (players with prese > 0)
    const winners = this.players.filter((p) => (preseMap.get(p.id) || 0) > 0)

    if (bestiaPlayers.length > 0) {
      // Some players went bestia
      // Winners split pot proportionally by prese (out of 3 fixed prese)
      winners.forEach((player) => {
        const playerPrese = preseMap.get(player.id) || 0
        const share = (playerPrese / TOTAL_PRESE) * potAmount
        payouts.set(player.id, share)
      })

      // Bestia players pay the pot amount
      bestiaPlayers.forEach((playerId) => {
        payouts.set(playerId, -potAmount)
      })
    } else {
      // No bestia: winners split pot among themselves
      // Non-players (0 prese) pay nothing - they skipped the game
      winners.forEach((player) => {
        const playerPrese = preseMap.get(player.id) || 0
        const share = (playerPrese / TOTAL_PRESE) * potAmount
        payouts.set(player.id, share)
      })
    }

    return payouts
  }

  private submitResult(): void {
    // Calculate total prese (only from active players)
    let totalPrese = 0
    const bestiaPlayers: string[] = []
    const preseMap = new Map<string, number>()

    this.players.forEach((player) => {
      if (player.isActive) {
        const selection = this.playerSelection.get(player.id) || 'none'
        if (selection === 'bestia') {
          bestiaPlayers.push(player.id)
          preseMap.set(player.id, 0)
        } else if (selection === 'none') {
          preseMap.set(player.id, 0)
        } else {
          const preseCount = parseInt(selection)
          preseMap.set(player.id, preseCount)
          totalPrese += preseCount
        }
      }
    })

    // Must have exactly 3 prese to submit
    if (totalPrese !== 3) {
      return // Can't submit without exactly 3 prese
    }

    this.dispatchEvent(
      new CustomEvent('game-result', {
        detail: {
          prese: preseMap,
          bestia: bestiaPlayers,
        },
      })
    )

    // Reset form - create new instances to ensure reactivity
    this.playerSelection = new Map()
    this.players.forEach((player) => {
      this.playerSelection.set(player.id, 'none')
    })
    this.requestUpdate()
  }

  render() {
    // Calculate total prese (only from active players)
    let totalPrese = 0
    this.players.forEach((player) => {
      if (player.isActive) {
        const selection = this.playerSelection.get(player.id) || 'none'
        if (selection !== 'none' && selection !== 'bestia') {
          totalPrese += parseInt(selection)
        }
      }
    })

    const canSubmit = totalPrese === 3
    const payouts = this.calculatePayouts()
    const options = [
      { value: 'none' as const, label: 'Salta', icon: '○' },
      { value: '1' as const, label: '1 Presa', icon: '●' },
      { value: '2' as const, label: '2 Prese', icon: '●●' },
      { value: '3' as const, label: '3 Prese', icon: '●●●' },
      { value: 'bestia' as const, label: 'Bestia', icon: '💣' },
    ]

    return html`
      <div class="game-input-container">
        <div class="game-header">
          <div class="header-info">
            <span class="label">Mazziere:</span>
            <span class="value">${this.dealer}</span>
          </div>
          <div class="header-info">
            <span class="label">Banco Attuale:</span>
            <span class="value">${this.currency}${this.currentPot.toFixed(2)}</span>
          </div>
        </div>

        <h2>Registra Risultato Giro</h2>
        <p class="instructions">Seleziona un'opzione per giocatore (esattamente 3 prese totali richieste)</p>

        <div class="players-input-grid">
          ${this.players.filter((p) => p.isActive).map(
            (player) => html`
              <div class="player-input-card">
                <div class="player-name">${player.name}</div>

                <fieldset class="radio-group">
                  <legend class="sr-only">Seleziona prese per ${player.name}</legend>
                  ${options.map(
                    (option) => html`
                      <label class="radio-label">
                        <input
                          type="radio"
                          name="prese-${player.id}"
                          value=${option.value}
                          .checked=${(this.playerSelection.get(player.id) || 'none') === option.value}
                          @change=${() => this.setPlayerSelection(player.id, option.value)}
                        />
                        <span class="radio-content">
                          <span class="radio-icon">${option.icon}</span>
                          <span class="radio-label-text">${option.label}</span>
                        </span>
                      </label>
                    `
                  )}
                </fieldset>

                ${payouts.get(player.id) !== 0
                  ? html`
                      <div class="payout ${payouts.get(player.id)! > 0 ? 'win' : 'loss'}">
                        ${payouts.get(player.id)! > 0 ? '+' : ''}${this.currency}${Math.abs(payouts.get(player.id)!).toFixed(2)}
                      </div>
                    `
                  : ''}
              </div>
            `
          )}
        </div>

        <button class="submit-btn" @click=${this.submitResult} ?disabled=${!canSubmit}>
          Registra Risultato
        </button>
      </div>
    `
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .game-input-container {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .game-header {
      display: flex;
      justify-content: space-around;
      gap: 2rem;
      padding: 1.5rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .header-info .label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--gray-700);
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }

    .header-info .value {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .instructions {
      margin: 0 0 1.5rem 0;
      font-size: 0.875rem;
      color: var(--gray-700);
    }

    .players-input-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .player-input-card {
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
      background: var(--gray-100);
      border-radius: 0.75rem;
      border: 2px solid transparent;
      transition: all 0.2s;
    }

    .player-name {
      font-weight: 700;
      color: var(--gray-900);
      font-size: 0.95rem;
      margin-bottom: 1rem;
      text-align: center;
      word-break: break-word;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border: none;
      padding: 0;
      margin: 0 0 1rem 0;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }

    .radio-label:hover {
      background: rgba(59, 130, 246, 0.05);
    }

    .radio-label input[type='radio'] {
      margin: 0;
      cursor: pointer;
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    .radio-label input[type='radio']:checked {
      accent-color: var(--primary);
    }

    .radio-content {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex: 1;
    }

    .radio-icon {
      font-size: 1rem;
      font-weight: 700;
    }

    .radio-label-text {
      font-size: 0.875rem;
      color: var(--gray-700);
    }

    .radio-label input[type='radio']:checked + .radio-content {
      color: var(--primary);
      font-weight: 600;
    }

    .payout {
      font-size: 0.875rem;
      font-weight: 700;
      margin-top: 0.75rem;
      padding: 0.5rem;
      border-radius: 0.375rem;
      text-align: center;
    }

    .payout.win {
      background: #dcfce7;
      color: #15803d;
    }

    .payout.loss {
      background: #fee2e2;
      color: #991b1b;
    }

    .submit-btn {
      width: 100%;
      padding: 1rem;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
      min-height: 48px;
    }

    .submit-btn:hover:not(:disabled) {
      background: #059669;
    }

    .submit-btn:disabled {
      background: #d1d5db;
      cursor: not-allowed;
      opacity: 0.6;
    }

    @media (max-width: 640px) {
      .game-input-container {
        padding: 1.5rem;
      }

      .game-header {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }

      .players-input-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .player-input-card {
        padding: 1rem;
      }

      .player-name {
        font-size: 0.875rem;
      }

      .prese-btn {
        width: 36px;
        height: 36px;
        font-size: 1rem;
      }

      .bestia-btn {
        width: 40px;
        height: 40px;
        font-size: 1.125rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'game-input': GameInput
  }
}
