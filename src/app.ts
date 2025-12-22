import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { GameSession } from './types.js'
import { StorageService } from './storage.js'
import './components/game-setup.js'
import './components/player-list.js'
import './components/game-actions.js'
import './components/game-history.js'
import './components/game-settings.js'

type TabType = 'record' | 'history' | 'settings'

@customElement('bestia-app')
export class BestiaApp extends LitElement {
  @state()
  private session: GameSession | null = null

  @state()
  private showSetup = false

  @state()
  private activeTab: TabType = 'record'

  connectedCallback() {
    super.connectedCallback()
    this.loadSession()
  }

  private loadSession(): void {
    const saved = StorageService.getSession()
    if (saved) {
      this.session = saved
      this.showSetup = false
    } else {
      this.showSetup = true
    }
  }

  private handleSessionCreate(event: CustomEvent<{ players: string[]; piatto: number }>): void {
    const { players, piatto } = event.detail
    this.session = StorageService.createNewSession(players, piatto)
    this.showSetup = false
  }

  private handleNewGame(): void {
    StorageService.clearSession()
    this.session = null
    this.showSetup = true
  }

  private handleDealerSelected(event: CustomEvent<{ dealerId: string; dealerName: string }>): void {
    if (this.session) {
      const updatedSession = StorageService.recordDealerSelection(this.session, event.detail.dealerId)
      this.session = { ...updatedSession }
      this.requestUpdate()
    }
  }

  private handleRoundRecorded(event: CustomEvent<{ prese: Map<string, number>; bestia: string[] }>): void {
    if (this.session) {
      const updatedSession = StorageService.recordRound(this.session, event.detail.prese, event.detail.bestia)
      // Force reactivity by reassigning the entire session object
      this.session = { ...updatedSession }
      this.requestUpdate()
    }
  }

  private handleGiroChiusoRecorded(): void {
    if (this.session) {
      const updatedSession = StorageService.recordGiroChiuso(this.session)
      // Force reactivity by reassigning the entire session object
      this.session = { ...updatedSession }
      this.requestUpdate()
    }
  }

  private handleDeleteEvent(event: CustomEvent<{ eventId: string }>): void {
    if (this.session) {
      const eventId = event.detail.eventId
      this.session.events = this.session.events.filter((e) => e.id !== eventId)
      StorageService.saveSession(this.session)
      this.session = { ...this.session }
      this.requestUpdate()
    }
  }

  private handlePiattoChanged(event: CustomEvent<{ piatto: number }>): void {
    if (this.session) {
      const updatedSession = StorageService.updatePiatto(this.session, event.detail.piatto)
      this.session = { ...updatedSession }
      this.requestUpdate()
    }
  }

  private handlePlayerOrderChanged(event: CustomEvent<{ playerIds: string[] }>): void {
    if (this.session) {
      const updatedSession = StorageService.updatePlayerOrder(this.session, event.detail.playerIds)
      this.session = { ...updatedSession }
      this.requestUpdate()
    }
  }

  render() {
    if (this.showSetup || !this.session) {
      return html`<game-setup @create-session=${this.handleSessionCreate}></game-setup>`
    }

    return html`
      <div class="container">
        <header class="header">
          <h1>Bestia</h1>
          <button class="new-game-btn" @click=${this.handleNewGame}>Nuova Partita</button>
        </header>

        <div class="game-info">
          <div class="info-card">
            <span class="label">Piatto</span>
            <span class="value">€${(this.session.piatto || 0).toFixed(2)}</span>
          </div>
          <div class="info-card">
            <span class="label">Banco Attuale</span>
            <span class="value">€${StorageService.calculateCurrentPot(this.session).toFixed(2)}</span>
          </div>
          <div class="info-card">
            <span class="label">Mazziere</span>
            <span class="value">${this.session ? this.session.players.find((p) => p.id === StorageService.getCurrentDealerId(this.session!))?.name || 'Unknown' : 'Unknown'}</span>
          </div>
        </div>

        <player-list
          .players=${this.session.players}
          .balances=${StorageService.calculatePlayerBalances(this.session)}
        ></player-list>

        <div class="tabs-container">
          <div class="tabs-nav">
            <button
              class="tab-btn ${this.activeTab === 'record' ? 'active' : ''}"
              @click=${() => (this.activeTab = 'record')}
            >
              Registra Risultato
            </button>
            <button
              class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}"
              @click=${() => (this.activeTab = 'history')}
            >
              Registro (${this.session.events.length})
            </button>
            <button
              class="tab-btn ${this.activeTab === 'settings' ? 'active' : ''}"
              @click=${() => (this.activeTab = 'settings')}
            >
              ⚙ Impostazioni
            </button>
          </div>

          <div class="tabs-content">
            ${this.activeTab === 'record'
              ? html`
                  <game-actions
                    .players=${this.session.players}
                    .currentDealer=${this.session ? this.session.players.find((p) => p.id === StorageService.getCurrentDealerId(this.session!))?.name || 'Unknown' : 'Unknown'}
                    .nextDealerId=${this.session ? StorageService.getNextDealerId(this.session) : ''}
                    .currentPot=${this.session ? StorageService.calculateCurrentPot(this.session) : 0}
                    .piatto=${this.session?.piatto || 0}
                    @dealer-selected=${this.handleDealerSelected}
                    @round-recorded=${this.handleRoundRecorded}
                    @giro-chiuso-recorded=${this.handleGiroChiusoRecorded}
                  ></game-actions>
                `
              : this.activeTab === 'history'
                ? html`
                    <game-history
                      .events=${this.session.events}
                      .players=${this.session.players}
                      @delete-event=${this.handleDeleteEvent}
                    ></game-history>
                  `
                : html`
                    <game-settings
                      .players=${this.session.players}
                      .piatto=${this.session.piatto}
                      @piatto-changed=${this.handlePiattoChanged}
                      @player-order-changed=${this.handlePlayerOrderChanged}
                    ></game-settings>
                  `}
          </div>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;

      display: block;
      background: var(--gray-50);
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--gray-900);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding: 0 0 1rem 0;
      border-bottom: 2px solid var(--gray-200);
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary);
    }

    .new-game-btn {
      padding: 0.5rem 1rem;
      background: var(--danger);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .new-game-btn:hover {
      background: #dc2626;
    }

    .game-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .info-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .label {
      font-size: 0.875rem;
      color: var(--gray-700);
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
    }

    .tabs-container {
      margin-top: 2rem;
    }

    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0;
      border-bottom: 2px solid var(--gray-200);
    }

    .tab-btn {
      padding: 1rem 1.5rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .tab-btn:hover {
      color: var(--primary);
    }

    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .tabs-content {
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (max-width: 640px) {
      .container {
        padding: 0.75rem;
      }

      .header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      h1 {
        font-size: 1.5rem;
      }

      .tab-btn {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'bestia-app': BestiaApp
  }
}
