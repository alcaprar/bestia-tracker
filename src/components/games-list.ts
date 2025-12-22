import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { StorageService, type SavedGame } from '../storage.js'

@customElement('games-list')
export class GamesList extends LitElement {
  @property({ type: Array })
  games: SavedGame[] = []

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  private resumeGame(gameId: string): void {
    this.dispatchEvent(
      new CustomEvent('game-selected', {
        detail: { gameId },
      })
    )
  }

  private deleteGame(gameId: string, event: Event): void {
    event.stopPropagation()

    if (confirm('Sei sicuro di voler eliminare questa partita?')) {
      StorageService.deleteGame(gameId)
      this.games = StorageService.getAllGames()
      this.requestUpdate()
    }
  }

  render() {
    if (this.games.length === 0) {
      return html`
        <div class="empty-state">
          <h2>Nessuna partita salvata</h2>
          <p>Crea una nuova partita per iniziare.</p>
        </div>
      `
    }

    // Sort games by date, newest first
    const sortedGames = [...this.games].sort((a, b) => b.createdAt - a.createdAt)

    return html`
      <div class="games-container">
        <h2>Le Mie Partite</h2>
        <div class="games-table">
          <div class="table-header">
            <div class="col-date">Data Inizio</div>
            <div class="col-players">Giocatori</div>
            <div class="col-rounds">Giri</div>
            <div class="col-actions">Azioni</div>
          </div>

          <div class="table-body">
            ${sortedGames.map(
              (game) => html`
                <div class="table-row" @click=${() => this.resumeGame(game.id)}>
                  <div class="col-date">${this.formatDate(game.createdAt)}</div>
                  <div class="col-players">
                    ${game.session.players
                      .filter((p) => p.isActive)
                      .map((p) => p.name)
                      .join(', ')}
                  </div>
                  <div class="col-rounds">${game.session.events.filter((e) => e.type === 'round_end').length}</div>
                  <div class="col-actions">
                    <button class="delete-btn" @click=${(e: Event) => this.deleteGame(game.id, e)} title="Elimina partita">🗑️</button>
                  </div>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    .games-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    h2 {
      margin: 0 0 2rem 0;
      font-size: 1.875rem;
      font-weight: 700;
      color: #111827;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .empty-state h2 {
      color: #3b82f6;
      margin-bottom: 1rem;
    }

    .empty-state p {
      color: #6b7280;
      margin: 0;
    }

    .games-table {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .table-header {
      display: grid;
      grid-template-columns: 200px 1fr 100px 80px;
      gap: 1rem;
      padding: 1rem;
      background: #f3f4f6;
      border-bottom: 2px solid #e5e7eb;
      font-weight: 700;
      color: #374151;
      font-size: 0.875rem;
      position: sticky;
      top: 0;
    }

    .table-body {
      display: flex;
      flex-direction: column;
    }

    .table-row {
      display: grid;
      grid-template-columns: 200px 1fr 100px 80px;
      gap: 1rem;
      padding: 1.25rem 1rem;
      border-bottom: 1px solid #e5e7eb;
      align-items: center;
      cursor: pointer;
      transition: background 0.2s;
    }

    .table-row:hover {
      background: #f9fafb;
    }

    .table-row:last-child {
      border-bottom: none;
    }

    .col-date {
      font-size: 0.875rem;
      color: #374151;
    }

    .col-players {
      font-size: 0.875rem;
      color: #374151;
    }

    .col-rounds {
      text-align: center;
      font-size: 0.875rem;
      color: #3b82f6;
      font-weight: 600;
    }

    .col-actions {
      display: flex;
      justify-content: center;
    }

    .delete-btn {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      background: transparent;
      font-size: 1.25rem;
      cursor: pointer;
      border-radius: 0.375rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .delete-btn:hover {
      background: #fee2e2;
    }

    @media (max-width: 768px) {
      .games-container {
        padding: 1rem;
      }

      .table-header {
        grid-template-columns: 1fr;
      }

      .table-row {
        grid-template-columns: 1fr;
      }

      .col-date::before {
        content: 'Data: ';
        font-weight: 700;
      }

      .col-players::before {
        content: 'Giocatori: ';
        font-weight: 700;
      }

      .col-rounds::before {
        content: 'Giri: ';
        font-weight: 700;
      }

      .col-rounds {
        text-align: left;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'games-list': GamesList
  }
}
