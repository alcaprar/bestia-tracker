import { LitElement, css, html } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Player, GameEvent } from '../types.js';
import './game-input.js';

type ActionStep = 'menu' | 'select_dealer' | 'record_result' | 'giro_chiuso' | 'manual_entry';

@customElement('game-actions')
export class GameActions extends LitElement {
  @property({ type: Array })
  players: Player[] = [];

  @property({ type: String })
  currentDealer: string = '';

  @property({ type: String })
  nextDealerId: string = '';

  @property({ type: Number })
  currentPot: number = 0;

  @property({ type: Number })
  piatto: number = 0;

  @property({ type: String })
  currency: string = '€';

  @property({ type: String })
  editingEventId: string | null = null;

  @property({ type: Array })
  events: GameEvent[] = [];

  @property({ type: Object })
  reviewingResult: {
    prese: Map<string, number>;
    bestia: Map<string, string>;
    calculatedAmounts: Map<string, number>;
  } | null = null;

  @state()
  private step: ActionStep = 'menu';

  @state()
  private selectedDealerId: string = '';

  @state()
  private manualAmounts: Map<string, number> = new Map();

  @state()
  private manualDescription: string = '';

  connectedCallback() {
    super.connectedCallback();
    if (this.players.length > 0 && !this.selectedDealerId) {
      this.selectedDealerId = this.players[0].id;
    }
  }

  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    // Handle edit mode
    if (changedProperties.has('editingEventId') && this.editingEventId) {
      const eventToEdit = this.events.find((e) => e.id === this.editingEventId);
      if (eventToEdit) {
        this.step = 'manual_entry';
        this.populateFormWithEvent(eventToEdit);
      }
    }

    // Handle review mode
    if (changedProperties.has('reviewingResult') && this.reviewingResult) {
      this.step = 'manual_entry';
      this.populateFormWithReview(this.reviewingResult);
    }
  }

  private populateFormWithEvent(event: GameEvent): void {
    // Clear existing state
    this.manualAmounts = new Map();

    // Populate amounts from event transactions
    event.transactions.forEach((transaction) => {
      this.manualAmounts.set(transaction.playerId, transaction.amount);
    });

    // Populate description if it exists
    this.manualDescription = event.metadata?.description || '';

    this.requestUpdate();
  }

  private populateFormWithReview(review: {
    prese: Map<string, number>;
    bestia: Map<string, string>;
    calculatedAmounts: Map<string, number>;
  }): void {
    // Clear existing state
    this.manualAmounts = new Map();

    // Populate with calculated amounts
    review.calculatedAmounts.forEach((amount, playerId) => {
      this.manualAmounts.set(playerId, amount);
    });

    // No description in review mode
    this.manualDescription = '';

    this.requestUpdate();
  }

  private selectDealer(): void {
    this.step = 'select_dealer';
    // Suggest the next dealer if available, otherwise use current dealer
    this.selectedDealerId =
      this.nextDealerId ||
      this.players.find((p) => p.name === this.currentDealer)?.id ||
      this.players[0].id;
  }

  private selectRecordResult(): void {
    this.step = 'record_result';
  }

  private selectGiroChiuso(): void {
    this.step = 'giro_chiuso';
  }

  private selectManualEntry(): void {
    this.step = 'manual_entry';
    // Initialize all active players with 0
    this.manualAmounts = new Map();
    this.players
      .filter((p) => p.isActive)
      .forEach((player) => {
        this.manualAmounts.set(player.id, 0);
      });
  }

  private confirmDealer(): void {
    // Read the actual value from the select element to ensure we have the correct id
    const selectElement = this.shadowRoot?.querySelector('select') as HTMLSelectElement;
    const dealerId = selectElement?.value || this.selectedDealerId;

    const dealer = this.players.find((p) => p.id === dealerId);
    if (dealer) {
      this.dispatchEvent(
        new CustomEvent('dealer-selected', {
          detail: { dealerId: dealerId, dealerName: dealer.name },
        })
      );
      this.backToMenu();
    }
  }

  private backToMenu(): void {
    // If reviewing, go back to result selection
    if (this.reviewingResult) {
      this.step = 'record_result';
      this.dispatchEvent(
        new CustomEvent('review-cancelled', {
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

    this.step = 'menu';

    // Notify parent to clear edit mode
    if (this.editingEventId) {
      this.dispatchEvent(
        new CustomEvent('cancel-edit', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private handleRecordResult(event: CustomEvent): void {
    this.dispatchEvent(
      new CustomEvent('round-recorded', {
        detail: event.detail,
      })
    );
    this.backToMenu();
  }

  private confirmGiroChiuso(): void {
    this.dispatchEvent(new CustomEvent('giro-chiuso-recorded'));
    this.backToMenu();
  }

  private confirmManualEntry(): void {
    this.dispatchEvent(
      new CustomEvent('manual-entry-recorded', {
        detail: {
          amounts: this.manualAmounts,
          description: this.manualDescription || undefined,
        },
      })
    );
    this.manualAmounts = new Map();
    this.manualDescription = '';
    this.backToMenu();
  }

  private confirmManualEdit(): void {
    if (!this.editingEventId) return;

    this.dispatchEvent(
      new CustomEvent('manual-entry-edited', {
        detail: {
          eventId: this.editingEventId,
          amounts: this.manualAmounts,
          description: this.manualDescription || undefined,
        },
        bubbles: true,
        composed: true,
      })
    );

    this.manualAmounts = new Map();
    this.manualDescription = '';
    this.backToMenu();
  }

  private confirmReview(): void {
    if (!this.reviewingResult) return;

    this.dispatchEvent(
      new CustomEvent('round-confirmed', {
        detail: {
          prese: this.reviewingResult.prese,
          bestia: this.reviewingResult.bestia, // Now a Map<string, string> with bestia types
          adjustedAmounts: this.manualAmounts,
        },
        bubbles: true,
        composed: true,
      })
    );

    this.manualAmounts = new Map();
    this.step = 'menu';
  }

  private updateManualAmount(playerId: string, value: number): void {
    this.manualAmounts.set(playerId, value);
    this.requestUpdate();
  }

  private updateManualDescription(value: string): void {
    this.manualDescription = value;
    this.requestUpdate();
  }

  render() {
    if (this.step === 'menu') {
      return this.renderMenu();
    } else if (this.step === 'select_dealer') {
      return this.renderDealerSelection();
    } else if (this.step === 'record_result') {
      return this.renderRecordResult();
    } else if (this.step === 'giro_chiuso') {
      return this.renderGiroChiuso();
    } else if (this.step === 'manual_entry') {
      return this.renderManualEntry();
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

          <button class="action-btn manual-btn" @click=${this.selectManualEntry}>
            <div class="action-icon">✏️</div>
            <div class="action-title">Inserimento Manuale</div>
            <div class="action-desc">Regola valori personalizzati</div>
          </button>
        </div>
      </div>
    `;
  }

  private renderDealerSelection() {
    return html`
      <div class="actions-container">
        <div class="step-header">
          <h2>Select Dealer</h2>
          <button class="back-btn" @click=${this.backToMenu}>← Back</button>
        </div>

        <div class="dealer-selector">
          <select
            @change=${(e: Event) => {
              this.selectedDealerId = (e.target as HTMLSelectElement).value;
            }}
          >
            ${this.players
              .filter((p) => p.isActive)
              .map(
                (player) =>
                  html`<option value=${player.id} ?selected=${player.id === this.selectedDealerId}>
                    ${player.name}
                  </option>`
              )}
          </select>
        </div>

        <button class="confirm-btn" @click=${this.confirmDealer}>Confirm Dealer</button>
      </div>
    `;
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
          .currency=${this.currency}
          @game-result=${this.handleRecordResult}
        ></game-input>
      </div>
    `;
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
    `;
  }

  private renderManualEntry() {
    const hasAnyNonZero = Array.from(this.manualAmounts.values()).some((v) => v !== 0);
    const isEditing = !!this.editingEventId;
    const isReviewing = !!this.reviewingResult;

    // Determine title
    let title = 'Inserimento Manuale';
    if (isEditing) title = 'Modifica Inserimento';
    if (isReviewing) title = 'Conferma Risultato';

    // Determine button handler
    const handleConfirm = isEditing
      ? this.confirmManualEdit
      : isReviewing
        ? this.confirmReview
        : this.confirmManualEntry;

    // Determine button text
    let buttonText = 'Conferma Inserimento Manuale';
    if (isEditing) buttonText = 'Salva Modifiche';
    if (isReviewing) buttonText = 'Conferma';

    return html`
      <div class="actions-container">
        <div class="step-header">
          <h2>${title}</h2>
          <button class="back-btn" @click=${this.backToMenu}>← Indietro</button>
        </div>

        <div class="manual-info">
          <p>
            Inserisci importi personalizzati per ogni giocatore. I valori positivi sono vincite, i
            negativi sono perdite.
          </p>
          <p>
            Nota: I valori non devono sommare a zero - usa questa opzione per aggiustamenti
            speciali.
          </p>
        </div>

        <div class="manual-players-grid">
          ${this.players
            .filter((p) => p.isActive)
            .map((player) => {
              const amount = this.manualAmounts.get(player.id) || 0;
              return html`
                <div class="manual-player-row">
                  <label class="player-label">${player.name}</label>
                  <div class="amount-input-wrapper">
                    <span class="currency-symbol">${this.currency}</span>
                    <input
                      type="number"
                      step="any"
                      .value=${amount.toFixed(2)}
                      @input=${(e: Event) => {
                        const value = parseFloat((e.target as HTMLInputElement).value) || 0;
                        this.updateManualAmount(player.id, value);
                      }}
                      class="amount-input ${amount > 0 ? 'positive' : amount < 0 ? 'negative' : ''}"
                      placeholder="0.00"
                    />
                  </div>
                  ${amount !== 0
                    ? html`
                        <div class="amount-preview ${amount > 0 ? 'win' : 'loss'}">
                          ${amount > 0 ? '+' : ''}€${Math.abs(amount).toFixed(2)}
                        </div>
                      `
                    : ''}
                </div>
              `;
            })}
        </div>

        ${!isReviewing
          ? html`
              <div class="description-section">
                <label for="manual-description">Nota (opzionale):</label>
                <textarea
                  id="manual-description"
                  .value=${this.manualDescription}
                  @input=${(e: Event) => {
                    this.updateManualDescription((e.target as HTMLTextAreaElement).value);
                  }}
                  placeholder="Spiega perché è stato necessario questo aggiustamento manuale..."
                  rows="3"
                ></textarea>
              </div>
            `
          : ''}

        <button
          class="confirm-btn manual-confirm-btn"
          @click=${handleConfirm}
          ?disabled=${!hasAnyNonZero}
        >
          ${buttonText}
        </button>
      </div>
    `;
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

    .manual-btn:hover {
      border-color: #8b5cf6;
    }

    .manual-info {
      padding: 1.5rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }

    .manual-info p {
      margin: 0.5rem 0;
      color: var(--gray-900);
      line-height: 1.6;
      font-size: 0.875rem;
    }

    .manual-players-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .manual-player-row {
      display: grid;
      grid-template-columns: 150px 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
    }

    .player-label {
      font-weight: 700;
      color: var(--gray-900);
      font-size: 1rem;
    }

    .amount-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .currency-symbol {
      position: absolute;
      left: 1rem;
      font-weight: 600;
      color: var(--gray-700);
      pointer-events: none;
    }

    .amount-input {
      width: 100%;
      padding: 0.75rem 0.75rem 0.75rem 2rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-size: 1rem;
      font-family: 'Monaco', 'Courier New', monospace;
      font-weight: 600;
      transition: all 0.2s;
    }

    .amount-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .amount-input.positive {
      border-color: #10b981;
      background: #f0fdf4;
      color: #15803d;
    }

    .amount-input.negative {
      border-color: #ef4444;
      background: #fef2f2;
      color: #991b1b;
    }

    .amount-preview {
      font-weight: 700;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-family: 'Monaco', 'Courier New', monospace;
      min-width: 100px;
      text-align: center;
    }

    .amount-preview.win {
      background: #dcfce7;
      color: #15803d;
    }

    .amount-preview.loss {
      background: #fee2e2;
      color: #991b1b;
    }

    .description-section {
      margin-bottom: 2rem;
    }

    .description-section label {
      display: block;
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
    }

    .description-section textarea {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-family: inherit;
      resize: vertical;
      color: var(--gray-900);
    }

    .description-section textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .manual-confirm-btn {
      background: #8b5cf6;
    }

    .manual-confirm-btn:hover:not(:disabled) {
      background: #7c3aed;
    }

    .manual-confirm-btn:disabled {
      background: #d1d5db;
      cursor: not-allowed;
      opacity: 0.6;
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

      .manual-player-row {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }

      .amount-preview {
        justify-self: start;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'game-actions': GameActions;
  }
}
