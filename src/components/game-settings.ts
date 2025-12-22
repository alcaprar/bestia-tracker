import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Player } from '../types.js'
import type { PropertyValues } from 'lit'

@customElement('game-settings')
export class GameSettings extends LitElement {
  @property({ type: Array })
  players: Player[] = []

  @property({ type: Number })
  piatto: number = 0.3

  @property({ type: String })
  currency: string = '€'

  @state()
  private editedPiatto: number = 0.3

  @state()
  private editedCurrency: string = '€'

  @state()
  private playerOrder: Player[] = []

  @state()
  private draggedIndex: number | null = null

  @state()
  private newPlayerName: string = ''

  connectedCallback() {
    super.connectedCallback()
    this.editedPiatto = this.piatto
    this.editedCurrency = this.currency
    this.playerOrder = [...this.players]
  }

  willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties)
    // Sync playerOrder whenever players property changes
    if (changedProperties.has('players')) {
      this.playerOrder = [...this.players]
    }
    // Sync editedPiatto whenever piatto property changes
    if (changedProperties.has('piatto')) {
      this.editedPiatto = this.piatto
    }
    // Sync editedCurrency whenever currency property changes
    if (changedProperties.has('currency')) {
      this.editedCurrency = this.currency
    }
  }

  private updatePiatto(e: Event): void {
    const input = e.target as HTMLInputElement
    this.editedPiatto = parseFloat(input.value) || 0
  }

  private savePiatto(): void {
    this.dispatchEvent(
      new CustomEvent('piatto-changed', {
        detail: { piatto: this.editedPiatto },
      })
    )
  }

  private updateCurrency(e: Event): void {
    const input = e.target as HTMLInputElement
    this.editedCurrency = input.value
  }

  private saveCurrency(): void {
    this.dispatchEvent(
      new CustomEvent('currency-changed', {
        detail: { currency: this.editedCurrency },
      })
    )
  }

  private startDrag(index: number): void {
    this.draggedIndex = index
  }

  private dragOver(e: DragEvent): void {
    e.preventDefault()
  }

  private drop(index: number): void {
    if (this.draggedIndex === null || this.draggedIndex === index) {
      this.draggedIndex = null
      return
    }

    // Swap players
    const temp = this.playerOrder[this.draggedIndex]
    this.playerOrder[this.draggedIndex] = this.playerOrder[index]
    this.playerOrder[index] = temp

    this.draggedIndex = null
    this.requestUpdate()
  }

  private savePlayerOrder(): void {
    this.dispatchEvent(
      new CustomEvent('player-order-changed', {
        detail: { playerIds: this.playerOrder.map((p) => p.id) },
      })
    )
  }

  private addPlayer(): void {
    const name = this.newPlayerName.trim()
    if (name.length === 0) return

    this.dispatchEvent(
      new CustomEvent('player-added', {
        detail: { playerName: name },
      })
    )
    this.newPlayerName = ''
  }

  private togglePlayerStatus(playerId: string, isActive: boolean): void {
    this.dispatchEvent(
      new CustomEvent('player-status-changed', {
        detail: { playerId, isActive },
      })
    )
  }

  render() {
    return html`
      <div class="settings-container">
        <div class="settings-section">
          <h3>Piatto Base</h3>
          <div class="piatto-input-group">
            <label for="piatto-input">${this.editedCurrency}</label>
            <input
              id="piatto-input"
              type="number"
              step="0.01"
              min="0"
              .value=${this.editedPiatto.toString()}
              @change=${this.updatePiatto}
              @input=${this.updatePiatto}
            />
            <button class="save-btn" @click=${this.savePiatto}>Salva</button>
          </div>
        </div>

        <div class="settings-section">
          <h3>Simbolo Valuta</h3>
          <div class="currency-input-group">
            <input
              id="currency-input"
              type="text"
              maxlength="5"
              .value=${this.editedCurrency}
              @change=${this.updateCurrency}
              @input=${this.updateCurrency}
              placeholder="€"
            />
            <button class="save-btn" @click=${this.saveCurrency}>Salva</button>
          </div>
          <p class="help-text">Inserisci il simbolo che vuoi usare (€, $, £, pts, ecc.)</p>
        </div>

        <div class="settings-section">
          <h3>Aggiungi Giocatore</h3>
          <div class="add-player-group">
            <input
              type="text"
              placeholder="Nome del giocatore"
              .value=${this.newPlayerName}
              @input=${(e: Event) => (this.newPlayerName = (e.target as HTMLInputElement).value)}
              @keypress=${(e: KeyboardEvent) => e.key === 'Enter' && this.addPlayer()}
            />
            <button class="add-btn" @click=${this.addPlayer}>+ Aggiungi</button>
          </div>
        </div>

        <div class="settings-section">
          <h3>Ordine Giocatori</h3>
          <p class="help-text">Trascinare per riordinare i giocatori. Questo determina la rotazione del mazziere.</p>
          <div class="player-list">
            ${this.playerOrder.map(
              (player, index) => html`
                <div
                  class="player-item ${this.draggedIndex === index ? 'dragging' : ''} ${!player.isActive ? 'inactive' : ''}"
                  draggable="true"
                  @dragstart=${() => this.startDrag(index)}
                  @dragover=${this.dragOver}
                  @drop=${() => this.drop(index)}
                >
                  <span class="drag-handle">⋮⋮</span>
                  <span class="player-name">${player.name}</span>
                  <span class="position">#${index + 1}</span>
                  <button
                    class="status-btn ${player.isActive ? 'active' : 'inactive'}"
                    @click=${() => this.togglePlayerStatus(player.id, !player.isActive)}
                    title=${player.isActive ? 'Disattiva giocatore' : 'Attiva giocatore'}
                  >
                    ${player.isActive ? '✓' : '✕'}
                  </button>
                </div>
              `
            )}
          </div>
          <button class="save-btn large" @click=${this.savePlayerOrder}>Salva Ordine Giocatori</button>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .settings-container {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      margin: 0 auto;
    }

    .settings-section {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--gray-200);
    }

    .settings-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    h3 {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .piatto-input-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1rem;
    }

    .piatto-input-group label {
      font-weight: 700;
      color: var(--gray-700);
      font-size: 1.125rem;
    }

    .piatto-input-group input {
      padding: 0.5rem;
      border: 2px solid var(--gray-300);
      border-radius: 0.375rem;
      font-size: 1rem;
      width: 120px;
    }

    .piatto-input-group input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .currency-input-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1rem;
    }

    .currency-input-group input {
      padding: 0.5rem;
      border: 2px solid var(--gray-300);
      border-radius: 0.375rem;
      font-size: 1rem;
      flex: 1;
      max-width: 120px;
    }

    .currency-input-group input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .add-player-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .add-player-group input {
      flex: 1;
      padding: 0.75rem;
      border: 2px solid var(--gray-300);
      border-radius: 0.375rem;
      font-size: 1rem;
    }

    .add-player-group input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .add-btn {
      padding: 0.75rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }

    .add-btn:hover {
      background: #2563eb;
    }

    .help-text {
      margin: 0 0 1rem 0;
      font-size: 0.875rem;
      color: var(--gray-700);
    }

    .player-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .player-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--gray-100);
      border: 2px solid transparent;
      border-radius: 0.5rem;
      cursor: grab;
      transition: all 0.2s;
    }

    .player-item:hover {
      background: var(--gray-200);
    }

    .player-item.dragging {
      opacity: 0.5;
      border-color: var(--primary);
      background: rgba(59, 130, 246, 0.1);
    }

    .player-item.inactive {
      opacity: 0.6;
      background: #f3f4f6;
    }

    .player-item.inactive .player-name {
      text-decoration: line-through;
      color: var(--gray-700);
    }

    .drag-handle {
      color: var(--gray-700);
      font-weight: 700;
      user-select: none;
    }

    .player-name {
      flex: 1;
      font-weight: 600;
      color: var(--gray-900);
    }

    .position {
      font-size: 0.875rem;
      color: var(--gray-700);
      font-weight: 600;
    }

    .status-btn {
      padding: 0.375rem 0.75rem;
      background: transparent;
      border: 2px solid var(--gray-300);
      border-radius: 0.375rem;
      color: var(--gray-700);
      cursor: pointer;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.2s;
    }

    .status-btn.active {
      color: var(--success);
      border-color: var(--success);
    }

    .status-btn.active:hover {
      background: rgba(16, 185, 129, 0.1);
    }

    .status-btn.inactive {
      color: #ef4444;
      border-color: #ef4444;
    }

    .status-btn.inactive:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .save-btn {
      padding: 0.75rem 1.5rem;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }

    .save-btn:hover {
      background: #059669;
    }

    .save-btn.large {
      width: 100%;
      padding: 1rem;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'game-settings': GameSettings
  }
}
