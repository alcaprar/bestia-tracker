import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Player } from '../types.js'
import './game-input.js'

type ActionStep = 'menu' | 'select_dealer' | 'record_result' | 'giro_chiuso'

@customElement('game-actions')
export class GameActions extends LitElement {
  @property({ type: Array })
  players: Player[] = []

  @property({ type: String })
  currentDealer: string = ''

  @property({ type: String })
  nextDealerId: string = ''

  @property({ type: Number })
  currentPot: number = 0

  @property({ type: Number })
  piatto: number = 0

  @state()
  private step: ActionStep = 'menu'

  @state()
  private selectedDealerId: string = ''

  connectedCallback() {
    super.connectedCallback()
    if (this.players.length > 0 && !this.selectedDealerId) {
      this.selectedDealerId = this.players[0].id
    }
  }

  private selectDealer(): void {
    this.step = 'select_dealer'
    // Suggest the next dealer if available, otherwise use current dealer
    this.selectedDealerId = this.nextDealerId || this.players.find((p) => p.name === this.currentDealer)?.id || this.players[0].id
  }

  private selectRecordResult(): void {
    this.step = 'record_result'
  }

  private selectGiroChiuso(): void {
    this.step = 'giro_chiuso'
  }

  private confirmDealer(): void {
    // Read the actual value from the select element to ensure we have the correct id
    const selectElement = this.shadowRoot?.querySelector('select') as HTMLSelectElement
    const dealerId = selectElement?.value || this.selectedDealerId

    const dealer = this.players.find((p) => p.id === dealerId)
    if (dealer) {
      this.dispatchEvent(
        new CustomEvent('dealer-selected', {
          detail: { dealerId: dealerId, dealerName: dealer.name },
        })
      )
      this.backToMenu()
    }
  }

  private backToMenu(): void {
    this.step = 'menu'
  }

  private handleRecordResult(event: CustomEvent): void {
    this.dispatchEvent(
      new CustomEvent('round-recorded', {
        detail: event.detail,
      })
    )
    this.backToMenu()
  }

  private confirmGiroChiuso(): void {
    this.dispatchEvent(new CustomEvent('giro-chiuso-recorded'))
    this.backToMenu()
  }

  render() {
    if (this.step === 'menu') {
      return this.renderMenu()
    } else if (this.step === 'select_dealer') {
      return this.renderDealerSelection()
    } else if (this.step === 'record_result') {
      return this.renderRecordResult()
    } else if (this.step === 'giro_chiuso') {
      return this.renderGiroChiuso()
    }
  }

  private renderMenu() {
    return html`
      <div class="actions-container">
        <h2>Cosa vuoi fare?</h2>
        <div class="actions-grid">
          <button class="action-btn dealer-btn" @click=${this.selectDealer}>
            <div class="action-icon">🎴</div>
            <div class="action-title">Seleziona Mazziere</div>
            <div class="action-desc">Chi fa il mazziere</div>
          </button>

          <button class="action-btn record-btn" @click=${this.selectRecordResult}>
            <div class="action-icon">📝</div>
            <div class="action-title">Registra Risultato</div>
            <div class="action-desc">Registra prese e bestia</div>
          </button>

          <button class="action-btn giro-btn" @click=${this.selectGiroChiuso}>
            <div class="action-icon">✋</div>
            <div class="action-title">Giro Chiuso</div>
            <div class="action-desc">Tutti pagano il banco</div>
          </button>
        </div>
      </div>
    `
  }

  private renderDealerSelection() {
    return html`
      <div class="actions-container">
        <div class="step-header">
          <h2>Select Dealer</h2>
          <button class="back-btn" @click=${this.backToMenu}>← Back</button>
        </div>

        <div class="dealer-selector">
          <select @change=${(e: Event) => {
            this.selectedDealerId = (e.target as HTMLSelectElement).value
          }}>
            ${this.players.map((player) => html`<option value=${player.id} ?selected=${player.id === this.selectedDealerId}>${player.name}</option>`)}
          </select>
        </div>

        <button class="confirm-btn" @click=${this.confirmDealer}>Confirm Dealer</button>
      </div>
    `
  }

  private renderRecordResult() {
    return html`
      <div class="actions-container">
        <div class="step-header">
          <h2>Record Game Result</h2>
          <button class="back-btn" @click=${this.backToMenu}>← Back</button>
        </div>

        <game-input
          .players=${this.players}
          .piatto=${this.piatto}
          .currentPot=${this.currentPot}
          .dealer=${this.currentDealer}
          @game-result=${this.handleRecordResult}
        ></game-input>
      </div>
    `
  }

  private renderGiroChiuso() {
    return html`
      <div class="actions-container">
        <div class="step-header">
          <h2>Giro Chiuso</h2>
          <button class="back-btn" @click=${this.backToMenu}>← Back</button>
        </div>

        <div class="giro-info">
          <p>All ${this.players.length} players will equally split and pay the current pot.</p>
          <p>Everyone agrees to continue the game without playing a round.</p>
        </div>

        <button class="confirm-btn giro-confirm-btn" @click=${this.confirmGiroChiuso}>
          Confirm Giro Chiuso
        </button>
      </div>
    `
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .actions-container {
      background: white;
      padding: 2rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h2 {
      margin: 0 0 2rem 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .step-header h2 {
      margin: 0;
    }

    .back-btn {
      padding: 0.5rem 1rem;
      background: var(--gray-200);
      color: var(--gray-900);
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .back-btn:hover {
      background: var(--gray-200);
      opacity: 0.8;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem 1.5rem;
      background: white;
      border: 2px solid var(--gray-200);
      border-radius: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;
    }

    .action-btn:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
      transform: translateY(-2px);
    }

    .action-icon {
      font-size: 2.5rem;
    }

    .action-title {
      font-weight: 700;
      color: var(--gray-900);
      font-size: 1.1rem;
    }

    .action-desc {
      font-size: 0.875rem;
      color: var(--gray-700);
      text-align: center;
    }

    .dealer-btn:hover {
      border-color: #8b5cf6;
    }

    .record-btn:hover {
      border-color: #06b6d4;
    }

    .giro-btn:hover {
      border-color: var(--warning);
    }

    .dealer-selector {
      margin-bottom: 2rem;
    }

    select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-size: 1rem;
      background: white;
      color: var(--gray-900);
      cursor: pointer;
    }

    select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .giro-info {
      padding: 1.5rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }

    .giro-info p {
      margin: 0.5rem 0;
      color: var(--gray-900);
      line-height: 1.6;
    }

    .confirm-btn {
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

    .confirm-btn:hover {
      background: #059669;
    }

    .giro-confirm-btn {
      background: var(--warning);
    }

    .giro-confirm-btn:hover {
      background: #d97706;
    }

    @media (max-width: 640px) {
      .actions-container {
        padding: 1.5rem;
      }

      h2 {
        font-size: 1.25rem;
      }

      .actions-grid {
        grid-template-columns: 1fr;
      }

      .action-btn {
        padding: 1.5rem 1rem;
      }

      .action-icon {
        font-size: 2rem;
      }

      .step-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'game-actions': GameActions
  }
}
