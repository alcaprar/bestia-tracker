import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { GameSession } from './types.js';
import { StorageService } from './storage.js';
import { getShareUrl, decodeGameFromSharing } from './utils/sharing.js';
import './components/game-setup.js';
import './components/player-list.js';
import './components/game-actions.js';
import './components/game-history.js';
import './components/game-settings.js';
import './components/game-stats.js';
import './components/games-list.js';
import './components/share-game-modal.js';

type TabType = 'record' | 'history' | 'settings' | 'statistics';
type Route = 'games' | 'game-new' | 'game-play';

@customElement('bestia-app')
export class BestiaApp extends LitElement {
  @state()
  private session: GameSession | null = null;

  @state()
  private activeTab: TabType = 'record';

  @state()
  private currentRoute: Route = 'games';

  @state()
  private allGames = StorageService.getAllGames();

  @state()
  private currentShareUrl: string = '';

  @state()
  private showPotInfoPopover: boolean = false;

  @state()
  private editingEventId: string | null = null;

  @state()
  private reviewingRoundResult: {
    prese: Map<string, number>;
    bestia: string[];
    calculatedAmounts: Map<string, number>;
  } | null = null;

  private boundHandleRouteChange = () => this.handleRouteChange();

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.boundHandleRouteChange);

    // Handle shared games from query parameter
    this.handleSharedGame();

    this.handleRouteChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.boundHandleRouteChange);
  }

  private handleSharedGame(): void {
    // Check if there's a share query parameter
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');

    if (shareParam) {
      // Decode the shared game
      const sharedSession = decodeGameFromSharing(shareParam);
      if (sharedSession) {
        // Check if a game with this ID already exists
        const existingGame = StorageService.getGameById(sharedSession.id);

        let importedSession: GameSession;
        let isUpdate = false;

        if (existingGame) {
          // Update existing game
          importedSession = {
            ...sharedSession,
            updatedAt: Date.now(),
          };
          isUpdate = true;
        } else {
          // Create new game with same ID as shared game
          importedSession = {
            ...sharedSession,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        }

        StorageService.saveSession(importedSession);
        this.allGames = StorageService.getAllGames();

        // Clean up the URL to remove the share parameter
        window.history.replaceState({}, document.title, window.location.pathname);

        // Show a success message
        const action = isUpdate ? 'aggiornata' : 'importata';
        const playerNames = importedSession.players.map((p) => p.name).join(', ');
        alert(`Partita ${action} con successo! "${playerNames}"`);
      }
    }
  }

  private handleRouteChange(): void {
    const hash = window.location.hash.slice(1) || 'games';
    const parts = hash.split('/').filter((p) => p);
    const [route, ...params] = parts;

    if (route === 'games') {
      this.currentRoute = 'games';
      this.session = null;
      this.allGames = StorageService.getAllGames();
      this.activeTab = 'record';
    } else if (route === 'game' && params[0] === 'new') {
      this.currentRoute = 'game-new';
      this.session = null;
      this.activeTab = 'record';
    } else if (route === 'game' && params[0]) {
      // Load specific game
      const gameId = params[0];
      const tabParam = params[1] as TabType | undefined;
      const game = StorageService.getGameById(gameId);
      if (game) {
        StorageService.setCurrentGame(gameId);
        this.session = game.session;
        this.currentRoute = 'game-play';
        // Set tab if provided, otherwise default to record
        if (tabParam && ['record', 'history', 'settings', 'statistics'].includes(tabParam)) {
          this.activeTab = tabParam;
        } else {
          this.activeTab = 'record';
        }
      } else {
        // Game not found, go back to games list
        window.location.hash = '/games';
      }
    }
  }

  private navigateToNewGame(): void {
    window.location.hash = '/game/new';
  }

  private navigateToGame(gameId: string): void {
    window.location.hash = `/game/${gameId}`;
  }

  private navigateToTab(tab: TabType): void {
    if (this.session) {
      window.location.hash = `/game/${this.session.id}/${tab}`;
    }
  }

  private handleSessionCreate(event: CustomEvent<{ players: string[]; piatto: number }>): void {
    const { players, piatto } = event.detail;
    const newSession = StorageService.createNewSession(players, piatto);
    // Update the URL to reflect the new game
    if (newSession) {
      window.location.hash = `/game/${newSession.id}`;
    }
  }

  private handleNewGame(): void {
    this.navigateToNewGame();
  }

  private handleGamesListSelection(event: CustomEvent<{ gameId: string }>): void {
    this.navigateToGame(event.detail.gameId);
  }

  private handleDealerSelected(event: CustomEvent<{ dealerId: string; dealerName: string }>): void {
    if (this.session) {
      const updatedSession = StorageService.recordDealerSelection(
        this.session,
        event.detail.dealerId
      );
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handleRoundRecorded(
    event: CustomEvent<{ prese: Map<string, number>; bestia: string[] }>
  ): void {
    if (this.session) {
      const { prese, bestia } = event.detail;

      // Calculate payouts without saving
      const calculatedAmounts = StorageService.calculateRoundPayouts(this.session, prese, bestia);

      // Store the review data to pass to game-actions
      this.reviewingRoundResult = {
        prese,
        bestia,
        calculatedAmounts,
      };

      this.requestUpdate();
    }
  }

  private handleGiroChiusoRecorded(): void {
    if (this.session) {
      const updatedSession = StorageService.recordGiroChiuso(this.session);
      // Force reactivity by reassigning the entire session object
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handleManualEntryRecorded(
    event: CustomEvent<{ amounts: Map<string, number>; description?: string }>
  ): void {
    if (this.session) {
      const updatedSession = StorageService.recordManualEntry(
        this.session,
        event.detail.amounts,
        event.detail.description
      );
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handleDeleteEvent(event: CustomEvent<{ eventId: string }>): void {
    if (this.session) {
      const eventId = event.detail.eventId;
      this.session.events = this.session.events.filter((e) => e.id !== eventId);
      StorageService.saveSession(this.session);
      this.session = { ...this.session };
      this.requestUpdate();
    }
  }

  private handleModifyEvent(event: CustomEvent<{ eventId: string }>): void {
    if (this.session) {
      const eventId = event.detail.eventId;
      const existingEvent = this.session.events.find((e) => e.id === eventId);

      if (existingEvent) {
        // Store the event ID being edited
        this.editingEventId = eventId;

        // Switch to the record tab where game-actions is displayed
        // Use navigateToTab to update both URL and activeTab
        this.navigateToTab('record');
      }
    }
  }

  private handleManualEntryEdited(
    event: CustomEvent<{
      eventId: string;
      amounts: Map<string, number>;
      description?: string;
    }>
  ): void {
    if (this.session) {
      const { eventId, amounts, description } = event.detail;

      // Update the event in the session
      const updatedSession = StorageService.updateManualEntry(
        this.session,
        eventId,
        amounts,
        description
      );

      this.session = { ...updatedSession };
      this.editingEventId = null;

      // Navigate back to history tab to show the updated event
      this.navigateToTab('history');
    }
  }

  private handleCancelEdit(): void {
    this.editingEventId = null;

    // Navigate back to history tab when cancelling edit
    this.navigateToTab('history');
  }

  private handleRoundConfirmed(
    event: CustomEvent<{
      prese: Map<string, number>;
      bestia: string[];
      adjustedAmounts: Map<string, number>;
    }>
  ): void {
    if (this.session && this.reviewingRoundResult) {
      const { prese, bestia, adjustedAmounts } = event.detail;

      // Create the round event with adjusted amounts
      const updatedSession = StorageService.recordRoundWithAmounts(
        this.session,
        prese,
        bestia,
        adjustedAmounts
      );

      this.session = { ...updatedSession };
      this.reviewingRoundResult = null;
      this.requestUpdate();
    }
  }

  private handleReviewCancelled(): void {
    this.reviewingRoundResult = null;
    this.requestUpdate();
  }

  private handlePiattoChanged(event: CustomEvent<{ piatto: number }>): void {
    if (this.session) {
      const updatedSession = StorageService.updatePiatto(this.session, event.detail.piatto);
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handleCurrencyChanged(event: CustomEvent<{ currency: string }>): void {
    if (this.session) {
      const updatedSession = StorageService.updateCurrency(this.session, event.detail.currency);
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handlePlayerOrderChanged(event: CustomEvent<{ playerIds: string[] }>): void {
    if (this.session) {
      const updatedSession = StorageService.updatePlayerOrder(this.session, event.detail.playerIds);
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handlePlayerAdded(event: CustomEvent<{ playerName: string }>): void {
    if (this.session) {
      const updatedSession = StorageService.addPlayer(this.session, event.detail.playerName);
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private handlePlayerStatusChanged(
    event: CustomEvent<{ playerId: string; isActive: boolean }>
  ): void {
    if (this.session) {
      const updatedSession = StorageService.togglePlayerActive(
        this.session,
        event.detail.playerId,
        event.detail.isActive
      );
      this.session = { ...updatedSession };
      this.requestUpdate();
    }
  }

  private openShareModal(): void {
    if (this.session) {
      this.currentShareUrl = getShareUrl(this.session);
      // Get modal reference using querySelector
      const modal = this.shadowRoot?.querySelector('share-game-modal') as any;
      if (modal) {
        modal.openModal();
      }
    }
  }

  private togglePotInfo(): void {
    this.showPotInfoPopover = !this.showPotInfoPopover;
  }

  private closePotInfo(): void {
    this.showPotInfoPopover = false;
  }

  render() {
    const footer = html`
      <footer class="footer">
        <a
          href="https://github.com/alcaprar/bestia-tracker"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Repository
        </a>
      </footer>
    `;

    // Games list route
    if (this.currentRoute === 'games') {
      return html`
        <div class="app-wrapper">
          <div class="container">
            <header class="header">
              <h1>Bestia</h1>
              <button class="new-game-btn" @click=${this.handleNewGame}>+ Nuova Partita</button>
            </header>
            <games-list
              .games=${this.allGames}
              @game-selected=${this.handleGamesListSelection}
            ></games-list>
          </div>
          ${footer}
        </div>
      `;
    }

    // New game setup route
    if (this.currentRoute === 'game-new') {
      return html`
        <div class="app-wrapper">
          <div class="container">
            <header class="header">
              <button
                class="back-btn"
                @click=${() => {
                  window.location.hash = '/games';
                }}
              >
                ← Giochi
              </button>
              <h1>Nuova Partita</h1>
            </header>
          </div>
          <game-setup @create-session=${this.handleSessionCreate}></game-setup>
          ${footer}
        </div>
      `;
    }

    // Game play route
    if (this.currentRoute === 'game-play' && this.session) {
      return html`
        <div class="app-wrapper">
          <share-game-modal
            .shareUrl=${this.currentShareUrl}
            .session=${this.session}
          ></share-game-modal>

          <div class="container">
            <header class="header">
              <button
                class="back-btn"
                @click=${() => {
                  window.location.hash = '/games';
                }}
              >
                ← Giochi
              </button>
              <h1>Bestia</h1>
              <button class="share-btn" @click=${this.openShareModal}>📤 Condividi</button>
            </header>

            <div class="game-info">
              <div class="info-card">
                <span class="label">Piatto</span>
                <span class="value"
                  >${this.session?.currency || '€'}${(this.session.piatto || 0).toFixed(2)}</span
                >
              </div>
              <div class="info-card pot-info-card">
                <div class="info-card-header">
                  <span class="label">Banco Attuale</span>
                  <button
                    class="info-icon-btn"
                    @click=${this.togglePotInfo}
                    title="Informazioni sulla divisione del banco"
                  >
                    ℹ️
                  </button>
                </div>
                <span class="value"
                  >${this.session?.currency || '€'}${StorageService.calculateCurrentPot(
                    this.session
                  ).toFixed(2)}</span
                >

                ${this.showPotInfoPopover
                  ? html`
                      <div class="pot-info-popover">
                        <button class="close-btn" @click=${this.closePotInfo}>✕</button>
                        <h3>Divisione del Banco</h3>
                        <ul class="pot-division-list">
                          <li>
                            <strong
                              >${this.session?.currency || '€'}${(
                                StorageService.calculateCurrentPot(this.session) / 3
                              ).toFixed(2)}</strong
                            >
                            → una presa
                          </li>
                          <li>
                            <strong
                              >${this.session?.currency || '€'}${(
                                (StorageService.calculateCurrentPot(this.session) / 3) *
                                2
                              ).toFixed(2)}</strong
                            >
                            → 2 prese
                          </li>
                          <li>
                            <strong
                              >${this.session?.currency || '€'}${(
                                StorageService.calculateCurrentPot(this.session) / 6
                              ).toFixed(2)}</strong
                            >
                            → una presa in due
                          </li>
                          <li>
                            <strong
                              >${this.session?.currency || '€'}${(
                                StorageService.calculateCurrentPot(this.session) / 9
                              ).toFixed(2)}</strong
                            >
                            → una presa in tre
                          </li>
                        </ul>
                      </div>
                    `
                  : ''}
                ${this.showPotInfoPopover
                  ? html` <div class="popover-backdrop" @click=${this.closePotInfo}></div> `
                  : ''}
              </div>
              <div class="info-card">
                <span class="label">Mazziere</span>
                <span class="value"
                  >${this.session
                    ? this.session.players.find(
                        (p) => p.id === StorageService.getCurrentDealerId(this.session!)
                      )?.name || 'Unknown'
                    : 'Unknown'}</span
                >
              </div>
              <div class="info-card">
                <span class="label">Inizio Partita</span>
                <span class="value"
                  >${this.session
                    ? new Date(this.session.createdAt).toLocaleString('it-IT', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : ''}</span
                >
              </div>
            </div>

            <player-list
              .players=${this.session.players}
              .balances=${StorageService.calculatePlayerBalances(this.session)}
              .currency=${this.session?.currency || '€'}
            ></player-list>

            <div class="tabs-container">
              <div class="tabs-nav">
                <button
                  class="tab-btn ${this.activeTab === 'record' ? 'active' : ''}"
                  @click=${() => this.navigateToTab('record')}
                >
                  Registra Risultato
                </button>
                <button
                  class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}"
                  @click=${() => this.navigateToTab('history')}
                >
                  Registro (${this.session.events.length})
                </button>
                <button
                  class="tab-btn ${this.activeTab === 'settings' ? 'active' : ''}"
                  @click=${() => this.navigateToTab('settings')}
                >
                  ⚙ Impostazioni
                </button>
                <button
                  class="tab-btn ${this.activeTab === 'statistics' ? 'active' : ''}"
                  @click=${() => this.navigateToTab('statistics')}
                >
                  📊 Statistiche
                </button>
              </div>

              <div class="tabs-content">
                ${this.activeTab === 'record'
                  ? html`
                      <game-actions
                        .players=${this.session.players}
                        .currentDealer=${this.session
                          ? this.session.players.find(
                              (p) => p.id === StorageService.getCurrentDealerId(this.session!)
                            )?.name || 'Unknown'
                          : 'Unknown'}
                        .nextDealerId=${this.session
                          ? StorageService.getNextDealerId(this.session)
                          : ''}
                        .currentPot=${this.session
                          ? StorageService.calculateCurrentPot(this.session)
                          : 0}
                        .piatto=${this.session?.piatto || 0}
                        .currency=${this.session?.currency || '€'}
                        .editingEventId=${this.editingEventId}
                        .events=${this.session.events}
                        .reviewingResult=${this.reviewingRoundResult}
                        @dealer-selected=${this.handleDealerSelected}
                        @round-recorded=${this.handleRoundRecorded}
                        @giro-chiuso-recorded=${this.handleGiroChiusoRecorded}
                        @manual-entry-recorded=${this.handleManualEntryRecorded}
                        @manual-entry-edited=${this.handleManualEntryEdited}
                        @cancel-edit=${this.handleCancelEdit}
                        @round-confirmed=${this.handleRoundConfirmed}
                        @review-cancelled=${this.handleReviewCancelled}
                      ></game-actions>
                    `
                  : this.activeTab === 'history'
                    ? html`
                        <game-history
                          .events=${this.session.events}
                          .players=${this.session.players}
                          .currency=${this.session?.currency || '€'}
                          @delete-event=${this.handleDeleteEvent}
                          @modify-event=${this.handleModifyEvent}
                        ></game-history>
                      `
                    : this.activeTab === 'settings'
                      ? html`
                          <game-settings
                            .players=${this.session.players}
                            .piatto=${this.session.piatto}
                            .currency=${this.session.currency || '€'}
                            @piatto-changed=${this.handlePiattoChanged}
                            @currency-changed=${this.handleCurrencyChanged}
                            @player-order-changed=${this.handlePlayerOrderChanged}
                            @player-added=${this.handlePlayerAdded}
                            @player-status-changed=${this.handlePlayerStatusChanged}
                          ></game-settings>
                        `
                      : html` <game-stats .session=${this.session}></game-stats> `}
              </div>
            </div>
          </div>
          ${footer}
        </div>
      `;
    }

    // Fallback - should not happen, but show setup as default
    return html`<game-setup @create-session=${this.handleSessionCreate}></game-setup>`;
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
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      margin-bottom: 2rem;
      padding: 0 0 1rem 0;
      border-bottom: 2px solid var(--gray-200);
      gap: 1rem;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary);
      text-align: center;
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

    .back-btn {
      padding: 0.5rem 1rem;
      background: transparent;
      color: var(--primary);
      border: 2px solid var(--primary);
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .back-btn:hover {
      background: var(--primary);
      color: white;
    }

    .share-btn {
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
    }

    .share-btn:hover {
      background: #2563eb;
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

    .pot-info-card {
      position: relative;
    }

    .info-card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .info-icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 0.25rem;
      line-height: 1;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .info-icon-btn:hover {
      opacity: 1;
    }

    .pot-info-popover {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 0.5rem;
      background: white;
      border: 2px solid var(--primary);
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      z-index: 1001;
      min-width: 280px;
      max-width: 320px;
    }

    .pot-info-popover h3 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .pot-division-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .pot-division-list li {
      padding: 0.5rem 0;
      font-size: 0.875rem;
      color: var(--gray-700);
      border-bottom: 1px solid var(--gray-200);
    }

    .pot-division-list li:last-child {
      border-bottom: none;
    }

    .pot-division-list strong {
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .close-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: var(--gray-700);
      padding: 0.25rem;
      line-height: 1;
      transition: color 0.2s;
    }

    .close-btn:hover {
      color: var(--gray-900);
    }

    .popover-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      background: transparent;
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

    .app-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .footer {
      margin-top: auto;
      padding: 2rem 1rem;
      text-align: center;
      border-top: 1px solid var(--gray-200);
      background: white;
    }

    .footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }

    .footer a:hover {
      color: #2563eb;
      text-decoration: underline;
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

      .pot-info-popover {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin-top: 0;
        max-width: 90vw;
      }

      .popover-backdrop {
        background: rgba(0, 0, 0, 0.3);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'bestia-app': BestiaApp;
  }
}
