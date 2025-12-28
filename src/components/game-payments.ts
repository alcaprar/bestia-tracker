import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { GameSession } from '../types.js';
import { StorageService } from '../storage.js';

@customElement('game-payments')
export class GamePayments extends LitElement {
  @property({ type: Object })
  session: GameSession | null = null;

  @property({ type: String })
  currency: string = '€';

  render() {
    if (!this.session) {
      return html` <div class="empty-state">Nessuna sessione attiva.</div> `;
    }

    const payments = StorageService.calculateSettlementPayments(this.session);

    if (payments.length === 0) {
      return html`
        <div class="payments-container">
          <div class="header">
            <h2>Pagamenti Suggeriti</h2>
            <p class="subtitle">Nessun pagamento necessario - tutti i conti sono in pareggio!</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="payments-container">
        <div class="header">
          <h2>Pagamenti Suggeriti</h2>
          <p class="subtitle">
            ${payments.length} ${payments.length === 1 ? 'pagamento' : 'pagamenti'} per saldare
            tutti i conti
          </p>
        </div>

        <div class="payments-list">
          ${payments.map(
            (payment, index) => html`
              <div class="payment-card">
                <div class="payment-number">${index + 1}</div>
                <div class="payment-details">
                  <span class="payer">${payment.fromName}</span>
                  <span class="arrow">→</span>
                  <span class="receiver">${payment.toName}</span>
                </div>
                <div class="payment-amount">${this.currency}${payment.amount.toFixed(2)}</div>
              </div>
            `
          )}
        </div>

        <div class="info-box">
          <p>
            💡 Questi pagamenti sono calcolati per ridurre al minimo il numero di transazioni
            necessarie.
          </p>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .payments-container {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #374151;
      font-size: 1.125rem;
    }

    .header {
      margin-bottom: 2rem;
    }

    .header h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
    }

    .subtitle {
      margin: 0;
      color: #6b7280;
      font-size: 0.95rem;
    }

    .payments-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .payment-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition:
        transform 0.2s,
        box-shadow 0.2s;
    }

    .payment-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .payment-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      background: #e0e7ff;
      color: #4f46e5;
      border-radius: 50%;
      font-weight: 700;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .payment-details {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      font-size: 1rem;
    }

    .payer {
      font-weight: 600;
      color: #ef4444;
    }

    .arrow {
      color: #9ca3af;
      font-size: 1.25rem;
    }

    .receiver {
      font-weight: 600;
      color: #10b981;
    }

    .payment-amount {
      font-size: 1.25rem;
      font-weight: 700;
      color: #111827;
      white-space: nowrap;
    }

    .info-box {
      padding: 1rem;
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      border-radius: 0.5rem;
    }

    .info-box p {
      margin: 0;
      color: #1e40af;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .payments-container {
        padding: 1rem;
      }

      .payment-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .payment-number {
        align-self: flex-start;
      }

      .payment-details {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }

      .arrow {
        display: none;
      }

      .payment-amount {
        align-self: flex-end;
      }
    }
  `;
}
