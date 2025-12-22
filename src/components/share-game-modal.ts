import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import QRCode from 'qrcode'
import type { GameSession } from '../types.js'

@customElement('share-game-modal')
export class ShareGameModal extends LitElement {
  @property({ type: String })
  shareUrl: string = ''

  @property({ type: Object })
  session: GameSession | null = null

  @state()
  private qrCodeDataUrl: string = ''

  @state()
  private showModal = false

  @state()
  private copied = false

  @state()
  private qrError: string = ''

  @state()
  private uncompressedSize: number = 0

  @state()
  private compressedSize: number = 0

  @state()
  private shortUrl: string = ''

  @state()
  private isGeneratingShortUrl = false

  @state()
  private showTechnicalDetails = false

  @state()
  private showLongLink = false

  updated() {
    if (this.showModal && !this.qrCodeDataUrl && !this.qrError && this.shareUrl) {
      this.calculateDataSizes()
      this.generateShortUrl().then(() => {
        this.generateQRCode()
      })
    }
  }

  private async generateShortUrl(): Promise<void> {
    if (this.shortUrl) return // Already generated

    // Always try to generate short URL
    this.isGeneratingShortUrl = true
    try {
      // Try using TinyURL API endpoint
      const response = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(this.shareUrl)}`,
        { method: 'GET' }
      )
      const shortUrl = await response.text()
      if (shortUrl && !shortUrl.includes('error')) {
        this.shortUrl = shortUrl.trim()
      } else {
        this.shortUrl = this.shareUrl
      }
    } catch (error) {
      console.error('Error generating short URL:', error)
      // Fallback: just use the original URL if shortening fails
      this.shortUrl = this.shareUrl
    } finally {
      this.isGeneratingShortUrl = false
    }
  }

  private calculateDataSizes(): void {
    // Calculate uncompressed size (original JSON)
    if (this.session) {
      const sessionData = {
        ...this.session,
        events: this.session.events.map((event) => ({
          ...event,
          metadata: event.metadata
            ? {
                ...event.metadata,
                prese: event.metadata.prese ? Array.from(event.metadata.prese.entries()) : undefined,
              }
            : undefined,
        })),
      }
      this.uncompressedSize = new Blob([JSON.stringify(sessionData)]).size
    }

    // Calculate compressed size (the query parameter part)
    const shareParam = new URL(`http://localhost${this.shareUrl}`).searchParams.get('share') || ''
    this.compressedSize = new Blob([shareParam]).size
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  private async generateQRCode(): Promise<void> {
    try {
      // Use short URL if available, otherwise use full URL
      const urlForQR = this.shortUrl || this.shareUrl
      const dataUrl = await QRCode.toDataURL(urlForQR, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'L', // Low error correction to fit more data
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      })
      this.qrCodeDataUrl = dataUrl
      this.qrError = ''
    } catch (error) {
      console.error('Error generating QR code:', error)
      this.qrError = 'QR code too large for this game. Use the link instead.'
      this.qrCodeDataUrl = ''
    }
  }

  private copyToClipboard(): void {
    // Copy the currently displayed URL (based on toggle)
    const urlToCopy = this.showLongLink ? this.shareUrl : (this.shortUrl || this.shareUrl)
    navigator.clipboard.writeText(urlToCopy)
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
    this.qrError = ''
    this.shortUrl = ''
    this.showTechnicalDetails = false
    this.showLongLink = false
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

            <!-- Link Section (PRIMARY) -->
            <div class="link-section">
              <h3>Link di Condivisione</h3>
              ${this.isGeneratingShortUrl ? html`<div class="loading">Generazione link breve...</div>` : ''}
              <div class="link-input-group">
                <input type="text" .value=${this.showLongLink ? this.shareUrl : (this.shortUrl || this.shareUrl)} readonly class="share-link" />
                <button class="copy-btn ${this.copied ? 'copied' : ''}" @click=${this.copyToClipboard}>
                  ${this.copied ? '✓ Copiato' : '📋 Copia'}
                </button>
              </div>
              ${this.shortUrl && this.shortUrl !== this.shareUrl
                ? html`<button class="toggle-link-btn" @click=${() => (this.showLongLink = !this.showLongLink)}>
                    ${this.showLongLink ? '🔒 Link breve' : '🔓 Link lungo (fallback)'}
                  </button>`
                : ''}
              <p class="help-text">Condividi questo link per permettere agli altri di importare la partita</p>
            </div>

            <!-- QR Code Section -->
            <div class="qr-section">
              <h3>Codice QR</h3>
              ${this.qrCodeDataUrl
                ? html`
                    <img src="${this.qrCodeDataUrl}" alt="QR Code" class="qr-code" />
                    <button class="download-qr-btn" @click=${this.downloadQRCode}>⬇️ Scarica QR</button>
                  `
                : this.qrError
                  ? html`<div class="qr-error">${this.qrError}</div>`
                  : html`<div class="loading">Generazione codice QR...</div>`}
            </div>

            <!-- Technical Details Toggle -->
            <div class="technical-details">
              <button class="toggle-btn" @click=${() => (this.showTechnicalDetails = !this.showTechnicalDetails)}>
                ${this.showTechnicalDetails ? '▼' : '▶'} Dettagli tecnici
              </button>
              ${this.showTechnicalDetails
                ? html`
                    <div class="data-info">
                      <div class="data-sizes-grid">
                        <div class="data-size-item">
                          <span class="label">Dati originali:</span>
                          <span class="value">${this.formatBytes(this.uncompressedSize)}</span>
                        </div>
                        <div class="data-size-item">
                          <span class="label">Dati compressi:</span>
                          <span class="value">${this.formatBytes(this.compressedSize)}</span>
                        </div>
                        ${this.uncompressedSize > 0
                          ? html`<div class="compression-ratio">
                              <span class="label">Compressione:</span>
                              <span class="value">${Math.round((1 - this.compressedSize / this.uncompressedSize) * 100)}%</span>
                            </div>`
                          : ''}
                      </div>
                      ${this.shortUrl && this.shortUrl !== this.shareUrl
                        ? html`
                            <div class="short-url-info">
                              <div class="short-url-item">
                                <span class="label">URL originale:</span>
                                <span class="value">${this.formatBytes(new Blob([this.shareUrl]).size)}</span>
                              </div>
                              <div class="short-url-item">
                                <span class="label">URL breve:</span>
                                <span class="value">${this.formatBytes(new Blob([this.shortUrl]).size)}</span>
                              </div>
                              <div class="savings">
                                <span class="label">Risparmio:</span>
                                <span class="value">${Math.round((1 - new Blob([this.shortUrl]).size / new Blob([this.shareUrl]).size) * 100)}%</span>
                              </div>
                            </div>
                          `
                        : ''}
                      <div class="capacity-bar">
                        <div class="bar-background">
                          <div class="bar-fill ${this.compressedSize > 2953 ? 'exceeded' : ''}" style="width: ${Math.min((this.compressedSize / 2953) * 100, 100)}%"></div>
                        </div>
                        <span class="capacity-text ${this.compressedSize > 2953 ? 'error' : 'ok'}">${this.compressedSize > 2953 ? `Superato di ${this.formatBytes(this.compressedSize - 2953)}` : `${Math.round((this.compressedSize / 2953) * 100)}% della capacità QR`}</span>
                      </div>
                    </div>
                  `
                : ''}
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

    .data-sizes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .data-size-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .data-size-item .label {
      font-weight: 600;
      color: var(--gray-700);
      font-size: 0.75rem;
    }

    .data-size-item .value {
      font-weight: 700;
      color: var(--primary);
      font-family: monospace;
      font-size: 1rem;
    }

    .compression-ratio {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 0.375rem;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .compression-ratio .label {
      font-weight: 600;
      color: var(--gray-700);
      font-size: 0.875rem;
    }

    .compression-ratio .value {
      font-weight: 700;
      color: #10b981;
      font-size: 1.125rem;
      font-family: monospace;
    }

    .short-url-info {
      padding: 0.75rem;
      background: rgba(34, 197, 94, 0.1);
      border-radius: 0.375rem;
      border: 1px solid rgba(34, 197, 94, 0.2);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .short-url-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
    }

    .short-url-item .label {
      font-weight: 600;
      color: var(--gray-700);
    }

    .short-url-item .value {
      font-weight: 700;
      color: #22c55e;
      font-family: monospace;
    }

    .savings {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(34, 197, 94, 0.3);
      font-weight: 700;
    }

    .savings .label {
      color: var(--gray-700);
    }

    .savings .value {
      color: #16a34a;
      font-size: 1rem;
      font-family: monospace;
    }

    .capacity-bar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .bar-background {
      height: 8px;
      background: #e0e7ff;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), #2563eb);
      transition: width 0.3s ease;
    }

    .bar-fill.exceeded {
      background: linear-gradient(90deg, #ef4444, #dc2626);
    }

    .capacity-text {
      font-size: 0.75rem;
      font-weight: 600;
      text-align: right;
    }

    .capacity-text.ok {
      color: var(--primary);
    }

    .capacity-text.error {
      color: #ef4444;
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

    .qr-error {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 0.375rem;
      color: #991b1b;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 500;
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

    .toggle-link-btn {
      align-self: flex-start;
      padding: 0.5rem 1rem;
      background: transparent;
      color: var(--primary);
      border: 1px solid var(--primary);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-link-btn:hover {
      background: var(--primary);
      color: white;
    }

    .help-text {
      margin: 0;
      font-size: 0.875rem;
      color: var(--gray-700);
    }

    .technical-details {
      border-top: 1px solid var(--gray-200);
      padding-top: 1rem;
      margin-top: 1rem;
    }

    .toggle-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.75rem;
      background: transparent;
      border: 1px solid var(--gray-200);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-btn:hover {
      background: var(--gray-100);
      border-color: var(--primary);
      color: var(--primary);
    }

    .data-info {
      margin-top: 1rem;
      padding: 1rem;
      background: #f0f9ff;
      border-left: 4px solid var(--primary);
      border-radius: 0.375rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
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
