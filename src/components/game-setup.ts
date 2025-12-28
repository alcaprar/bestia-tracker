import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('game-setup')
export class GameSetup extends LitElement {
  @state()
  private players: string[] = ['', '', '', '', '', '', '', '', '', ''];

  @state()
  private piatto: number = 0.3;

  @state()
  private errorMessage: string = '';

  private handlePlayerNameChange(index: number, value: string): void {
    this.players[index] = value;
    this.requestUpdate();
  }

  private handlePiattoChange(value: string): void {
    this.piatto = parseFloat(value) || 0;
  }

  private validateAndCreateSession(): void {
    this.errorMessage = '';

    const filledPlayers = this.players.filter((p) => p.trim().length > 0);

    if (filledPlayers.length < 2) {
      this.errorMessage = 'Inserisci almeno 2 nomi di giocatori';
      return;
    }

    if (this.piatto < 0) {
      this.errorMessage = 'Il valore del piatto deve essere non negativo';
      return;
    }

    this.dispatchEvent(
      new CustomEvent('create-session', {
        detail: {
          players: filledPlayers,
          piatto: this.piatto,
        },
      })
    );
  }

  render() {
    return html`
      <div class="setup-container">
        <div class="setup-card">
          <h1>Configurazione Partita Bestia</h1>

          <div class="form-section">
            <label>Piatto</label>
            <input
              type="number"
              step="0.01"
              .value=${this.piatto.toString()}
              @input=${(e: Event) => this.handlePiattoChange((e.target as HTMLInputElement).value)}
              placeholder="0.30"
            />
          </div>

          <div class="form-section">
            <label>Giocatori (almeno 2)</label>
            ${this.players.map(
              (player, index) => html`
                <input
                  type="text"
                  .value=${player}
                  @input=${(e: Event) =>
                    this.handlePlayerNameChange(index, (e.target as HTMLInputElement).value)}
                  placeholder="Nome Giocatore ${index + 1}"
                />
              `
            )}
          </div>

          ${this.errorMessage ? html` <div class="error-message">${this.errorMessage}</div> ` : ''}

          <div class="disclaimer">
            <h3>⚠️ Dichiarazione di Responsabilità</h3>
            <ul>
              <li>
                <strong>Gioco d'azzardo illegale:</strong> Ricorda che il gioco d'azzardo è illegale
                in molte giurisdizioni. Anche se Bestia potrebbe sembrare un gioco legale, verifica
                le leggi locali prima di giocare con denaro reale.
              </li>
              <li>
                <strong>Gioca responsabilmente:</strong> Stabilisci un limite di scommessa prima di
                iniziare e non superarlo.
              </li>
              <li>
                <strong>Non sei obbligato:</strong> Nessuno è obbligato a giocare. Se il gioco cessa
                di essere divertente, smetti di giocare.
              </li>
              <li>
                <strong>Dati locali:</strong> Tutti i dati del gioco vengono salvati localmente nel
                tuo browser e non vengono inviati a server remoti. Se cancelli i dati del browser,
                la cronologia dei giochi andrà persa permanentemente. Esegui backup manualmente se
                desideri conservare i dati.
              </li>
              <li>
                <strong>Nessuna responsabilità:</strong> Gli sviluppatori di questa app non sono
                responsabili per perdite monetarie, conseguenze legali o danni derivanti dall'uso di
                questa applicazione.
              </li>
            </ul>
            <p class="disclaimer-footer">
              Utilizzando questa app, accetti che hai letto e compreso questa dichiarazione.
            </p>
          </div>

          <button class="create-btn" @click=${this.validateAndCreateSession}>Inizia Partita</button>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --danger: #ef4444;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .setup-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--gray-50);
      padding: 1rem;
    }

    .setup-card {
      width: 100%;
      max-width: 400px;
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--primary);
      margin: 0 0 2rem 0;
      text-align: center;
    }

    .form-section {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--gray-700);
      margin-bottom: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 0.75rem;
      border: 1px solid var(--gray-200);
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .error-message {
      padding: 0.75rem;
      margin-bottom: 1rem;
      background: #fee2e2;
      color: #991b1b;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .disclaimer {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      color: #78350f;
    }

    .disclaimer h3 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 700;
      color: #b45309;
    }

    .disclaimer ul {
      margin: 0 0 1rem 0;
      padding-left: 1.5rem;
    }

    .disclaimer li {
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }

    .disclaimer strong {
      color: #b45309;
      font-weight: 700;
    }

    .disclaimer-footer {
      margin: 0;
      font-size: 0.8rem;
      font-style: italic;
      color: #92400e;
      border-top: 1px solid #f59e0b;
      padding-top: 0.75rem;
    }

    .create-btn {
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .create-btn:hover {
      background: #2563eb;
    }

    .create-btn:active {
      background: #1d4ed8;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'game-setup': GameSetup;
  }
}
