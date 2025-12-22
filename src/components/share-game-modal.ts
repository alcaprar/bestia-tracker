import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import QRCode from 'qrcode'

@customElement('share-game-modal')
export class ShareGameModal extends LitElement {
  @property({ type: String })
  shareUrl: string = ''

  @state()
  private qrCodeDataUrl: string = ''

  @state()
  private showModal = false

  @state()
  private copied = false

  updated() {
    if (this.showModal && !this.qrCodeDataUrl && this.shareUrl) {
      this.generateQRCode()
    }
  }

  private async generateQRCode(): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(this.shareUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      })
      this.qrCodeDataUrl = dataUrl
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  private copyToClipboard(): void {
    navigator.clipboard.writeText(this.shareUrl)
    this.copied = true
    setTimeout(() => {
      this.copied = false
    }, 2000)
  }

  private downloadQRCode(): void {
    const link = document.createElement('a')
    link.href = this.qrCodeDataUrl
    link.download = `bestia-game-qr-${new Date().toISOString().split('T')[0]}.png`
    link.click()
  }

  openModal(): void {
    this.showModal = true
    this.qrCodeDataUrl = ''
  }

  closeModal(): void {
    this.showModal = false
  }

  render() {
    if (!this.showModal) {
      return html``
    }

    return html`
      <div class="modal-overlay" @click=${this.closeModal}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Condividi Partita</h2>
            <button class="close-btn" @click=${this.closeModal}>✕</button>
          </div>

          <div class="modal-content">
            <div class="disclaimer">
              <strong>⚠️ Nota:</strong> Questo link condivide solo lo stato attuale della partita. Se apporterai modifiche dopo, l'altra persona non riceverà gli aggiornamenti. È solo una condivisione della fotografia della partita in questo momento.
            </div>

            <div class="qr-section">
              <h3>Codice QR</h3>
              ${this.qrCodeDataUrl
                ? html`
                    <img src="${this.qrCodeDataUrl}" alt="QR Code" class="qr-code" />
                    <button class="download-qr-btn" @click=${this.downloadQRCode}>⬇️ Scarica QR</button>
                  `
                : html`<div class="loading">Generazione codice QR...</div>`}
            </div>

            <div class="link-section">
              <h3>Link di Condivisione</h3>
              <div class="link-input-group">
                <input type="text" .value=${this.shareUrl} readonly class="share-link" />
                <button class="copy-btn ${this.copied ? 'copied' : ''}" @click=${this.copyToClipboard}>
                  ${this.copied ? '✓ Copiato' : '📋 Copia'}
                </button>
              </div>
              <p class="help-text">Condividi questo link per permettere agli altri di importare la partita</p>
            </div>
          </div>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid var(--gray-200);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .close-btn {
      background: transparent;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--gray-700);
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: var(--gray-100);
    }

    .modal-content {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .disclaimer {
      padding: 1rem;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: var(--gray-900);
      line-height: 1.5;
    }

    .qr-section,
    .link-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    h3 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .qr-code {
      max-width: 256px;
      height: auto;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      padding: 0.5rem;
      background: white;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: var(--gray-700);
      text-align: center;
    }

    .download-qr-btn {
      align-self: flex-start;
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .download-qr-btn:hover {
      background: #2563eb;
    }

    .link-input-group {
      display: flex;
      gap: 0.5rem;
    }

    .share-link {
      flex: 1;
      padding: 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-family: monospace;
      word-break: break-all;
    }

    .share-link:focus {
      outline: none;
      border-color: var(--primary);
    }

    .copy-btn {
      padding: 0.75rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: #2563eb;
    }

    .copy-btn.copied {
      background: #10b981;
    }

    .help-text {
      margin: 0;
      font-size: 0.875rem;
      color: var(--gray-700);
    }

    @media (max-width: 640px) {
      .modal-content {
        padding: 1.5rem;
      }

      .qr-code {
        max-width: 200px;
      }

      .link-input-group {
        flex-direction: column;
      }

      .copy-btn {
        width: 100%;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'share-game-modal': ShareGameModal
  }
}
