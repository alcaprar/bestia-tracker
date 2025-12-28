import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { GameSession } from '../types.js';
import { StorageService } from '../storage.js';
import Chart from 'chart.js/auto';

@customElement('game-stats')
export class GameStats extends LitElement {
  @property({ type: Object })
  session: GameSession | null = null;

  @state()
  private selectedPlayers: Set<string> = new Set();

  private charts: Map<string, Chart> = new Map();
  private hasInitializedPlayers = false;

  updated(): void {
    // Initialize selected players only once when session is first set
    if (!this.hasInitializedPlayers && this.session) {
      const initialSelected = new Set<string>();
      this.session.players.forEach((p) => {
        if (p.isActive) {
          initialSelected.add(p.id);
        }
      });
      this.selectedPlayers = initialSelected;
      this.hasInitializedPlayers = true;
    }

    // Reset initialization flag if session changes
    if (this.session && this.hasInitializedPlayers) {
      // Session is still the same, keep the flag
    }

    // Destroy old charts before creating new ones
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();

    // Create charts after render completes
    setTimeout(() => {
      this.createCharts();
    }, 0);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up charts when component is removed
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();
  }

  private getCurrency(): string {
    return this.session?.currency || '€';
  }

  private togglePlayer(playerId: string): void {
    if (this.selectedPlayers.has(playerId)) {
      this.selectedPlayers.delete(playerId);
    } else {
      this.selectedPlayers.add(playerId);
    }
    this.selectedPlayers = new Set(this.selectedPlayers); // Trigger reactivity
    this.requestUpdate();
  }

  private selectAllPlayers(): void {
    this.selectedPlayers = new Set(
      this.session!.players.filter((p) => p.isActive).map((p) => p.id)
    );
    this.requestUpdate();
  }

  private deselectAllPlayers(): void {
    this.selectedPlayers.clear();
    this.requestUpdate();
  }

  private createCharts(): void {
    if (!this.session) return;

    this.createBalanceProgressionChart();
    this.createCurrentBalanceChart();
    this.createWinRateChart();
    this.createBestiaCountChart();
  }

  private createBalanceProgressionChart(): void {
    const canvas = this.shadowRoot?.querySelector('#balanceProgressionChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy any existing chart on this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    // Get all events in order (not just round_end)
    const allEvents = this.session!.events;
    const labels = allEvents.map((e, i) => {
      if (e.type === 'round_end') return `Giro ${i + 1}`;
      if (e.type === 'dealer_pay') return 'Dealer';
      return 'Giro Chiuso';
    });

    const datasets = this.session!.players.filter(
      (p) => p.isActive && this.selectedPlayers.has(p.id)
    ).map((player, index) => {
      // Get full progression with all events
      const fullProgression: number[] = [];
      let lastBalance = 0;

      for (const event of allEvents) {
        const transaction = event.transactions.find((t) => t.playerId === player.id);
        if (transaction) {
          lastBalance += transaction.amount;
          fullProgression.push(lastBalance);
        } else {
          // Player didn't have a transaction in this event, use previous balance
          fullProgression.push(lastBalance);
        }
      }

      const colors = [
        '#3b82f6',
        '#ef4444',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#06b6d4',
        '#ec4899',
        '#14b8a6',
        '#f97316',
        '#6366f1',
      ];
      const color = colors[index % colors.length];

      return {
        label: player.name,
        data: fullProgression,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      };
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Evoluzione Bilancio nel Tempo',
            font: { size: 16, weight: 'bold' },
          },
          legend: {
            position: 'bottom',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: `Bilancio (${this.getCurrency()})`,
            },
          },
        },
      },
    });

    this.charts.set('balanceProgression', chart);
  }

  private createCurrentBalanceChart(): void {
    const canvas = this.shadowRoot?.querySelector('#currentBalanceChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy any existing chart on this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const balances = StorageService.calculatePlayerBalances(this.session!);
    const activePlayersWithBalances = this.session!.players.filter((p) => p.isActive)
      .map((p) => ({
        name: p.name,
        balance: balances.get(p.id) || 0,
      }))
      .sort((a, b) => b.balance - a.balance);

    const colors = activePlayersWithBalances.map((p) => (p.balance >= 0 ? '#10b981' : '#ef4444'));

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: activePlayersWithBalances.map((p) => p.name),
        datasets: [
          {
            label: `Bilancio Attuale (${this.getCurrency()})`,
            data: activePlayersWithBalances.map((p) => p.balance),
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 2,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'Bilancio Attuale per Giocatore',
            font: { size: 16, weight: 'bold' },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: `Bilancio (${this.getCurrency()})`,
            },
          },
        },
      },
    });

    this.charts.set('currentBalance', chart);
  }

  private createWinRateChart(): void {
    const canvas = this.shadowRoot?.querySelector('#winRateChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy any existing chart on this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const wins = StorageService.getPlayerWins(this.session!);
    const roundsPlayed = StorageService.getPlayerRoundsPlayed(this.session!);
    const losses = StorageService.getPlayerLosses(this.session!);

    const activePlayersStats = this.session!.players.filter((p) => p.isActive)
      .map((p) => {
        const playerWins = wins.get(p.id) || 0;
        const playerRounds = roundsPlayed.get(p.id) || 0;
        const playerLosses = losses.get(p.id) || 0;

        return {
          name: p.name,
          wins: playerWins,
          losses: playerLosses,
          roundsPlayed: playerRounds,
          winRate: playerRounds > 0 ? ((playerWins / playerRounds) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => b.wins - a.wins);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: activePlayersStats.map((p) => `${p.name}\n(${p.roundsPlayed} giri)`),
        datasets: [
          {
            label: 'Vittorie',
            data: activePlayersStats.map((p) => p.wins),
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 1,
          },
          {
            label: 'Sconfitte',
            data: activePlayersStats.map((p) => p.losses),
            backgroundColor: '#ef4444',
            borderColor: '#dc2626',
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: 'x',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'Vittorie, Sconfitte e Pareggi per Giocatore',
            font: { size: 16, weight: 'bold' },
          },
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              afterLabel: function (context: any) {
                const datasetIndex = context.datasetIndex;
                const dataIndex = context.dataIndex;
                if (datasetIndex === 0) {
                  // Only show win rate on the wins tooltip
                  return `Tasso Vittorie: ${activePlayersStats[dataIndex].winRate}%`;
                }
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });

    this.charts.set('winRate', chart);
  }

  private createBestiaCountChart(): void {
    const canvas = this.shadowRoot?.querySelector('#bestiaCountChart') as HTMLCanvasElement;
    if (!canvas) return;

    // Destroy any existing chart on this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }

    const bestiaCount = StorageService.getBestiaCount(this.session!);

    const activeBestiaCount = this.session!.players.filter((p) => p.isActive)
      .map((p) => ({
        name: p.name,
        count: bestiaCount.get(p.id) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: activeBestiaCount.map((p) => p.name),
        datasets: [
          {
            label: 'Volte Bestia',
            data: activeBestiaCount.map((p) => p.count),
            backgroundColor: '#ef4444',
            borderColor: '#dc2626',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'Quante Volte è Andata Bestia',
            font: { size: 16, weight: 'bold' },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });

    this.charts.set('bestiaCount', chart);
  }

  private getBiggestWin(): { playerName: string; amount: number } | null {
    if (!this.session) return null;

    const playerMap = new Map(this.session.players.map((p) => [p.id, p.name]));
    let biggestWin = 0;
    let winnerName = '';

    for (const event of this.session.events) {
      for (const { playerId, amount } of event.transactions) {
        if (amount > biggestWin) {
          biggestWin = amount;
          winnerName = playerMap.get(playerId) || 'Unknown';
        }
      }
    }

    return biggestWin > 0 ? { playerName: winnerName, amount: biggestWin } : null;
  }

  private getBiggestLoss(): { playerName: string; amount: number } | null {
    if (!this.session) return null;

    const playerMap = new Map(this.session.players.map((p) => [p.id, p.name]));
    let biggestLoss = 0;
    let loserName = '';

    for (const event of this.session.events) {
      for (const { playerId, amount } of event.transactions) {
        if (amount < -biggestLoss) {
          biggestLoss = -amount;
          loserName = playerMap.get(playerId) || 'Unknown';
        }
      }
    }

    return biggestLoss > 0 ? { playerName: loserName, amount: biggestLoss } : null;
  }

  private downloadChart(chartId: string, filename: string): void {
    const canvas = this.shadowRoot?.querySelector(`#${chartId}`) as HTMLCanvasElement;
    if (!canvas) return;

    // Create a temporary link to download the image
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  }

  render() {
    if (!this.session || this.session.events.length === 0) {
      return html`
        <div class="empty-state">
          Nessun evento registrato. Gioca qualche giro per vedere le statistiche.
        </div>
      `;
    }

    const biggestWin = this.getBiggestWin();
    const biggestLoss = this.getBiggestLoss();

    return html`
      <div class="stats-container">
        ${biggestWin || biggestLoss
          ? html`
              <div class="highlights-grid">
                ${biggestWin
                  ? html`
                      <div class="highlight-box win">
                        <div class="highlight-label">Vittoria Più Grande</div>
                        <div class="highlight-amount">
                          +${this.getCurrency()}${biggestWin.amount.toFixed(2)}
                        </div>
                        <div class="highlight-player">${biggestWin.playerName}</div>
                      </div>
                    `
                  : ''}
                ${biggestLoss
                  ? html`
                      <div class="highlight-box loss">
                        <div class="highlight-label">Perdita Più Grande</div>
                        <div class="highlight-amount">
                          -${this.getCurrency()}${biggestLoss.amount.toFixed(2)}
                        </div>
                        <div class="highlight-player">${biggestLoss.playerName}</div>
                      </div>
                    `
                  : ''}
              </div>
            `
          : ''}
        <div class="stats-grid">
          <div class="chart-card">
            <div class="chart-header">
              <h3>Evoluzione Bilancio nel Tempo</h3>
              <button
                class="download-btn"
                @click=${() => this.downloadChart('balanceProgressionChart', 'evoluzione-bilancio')}
                title="Scarica grafico"
              >
                ⬇️
              </button>
            </div>
            <div class="player-filter">
              <div class="filter-controls">
                <button
                  class="filter-btn ${this.selectedPlayers.size ===
                  this.session!.players.filter((p) => p.isActive).length
                    ? 'active'
                    : ''}"
                  @click=${this.selectAllPlayers}
                >
                  Tutti
                </button>
                <button class="filter-btn" @click=${this.deselectAllPlayers}>Nessuno</button>
              </div>
              <div class="player-checkboxes">
                ${this.session!.players.filter((p) => p.isActive).map(
                  (player) => html`
                    <label class="player-checkbox">
                      <input
                        type="checkbox"
                        .checked=${this.selectedPlayers.has(player.id)}
                        @change=${() => this.togglePlayer(player.id)}
                      />
                      <span>${player.name}</span>
                    </label>
                  `
                )}
              </div>
            </div>
            <canvas id="balanceProgressionChart"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <h3>Bilancio Attuale per Giocatore</h3>
              <button
                class="download-btn"
                @click=${() => this.downloadChart('currentBalanceChart', 'bilancio-attuale')}
                title="Scarica grafico"
              >
                ⬇️
              </button>
            </div>
            <canvas id="currentBalanceChart"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <h3>Vittorie, Sconfitte e Pareggi per Giocatore</h3>
              <button
                class="download-btn"
                @click=${() => this.downloadChart('winRateChart', 'vittorie-sconfitte')}
                title="Scarica grafico"
              >
                ⬇️
              </button>
            </div>
            <canvas id="winRateChart"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-header">
              <h3>Quante Volte è Andata Bestia</h3>
              <button
                class="download-btn"
                @click=${() => this.downloadChart('bestiaCountChart', 'bestia-count')}
                title="Scarica grafico"
              >
                ⬇️
              </button>
            </div>
            <canvas id="bestiaCountChart"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .stats-container {
      padding: 1.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #374151;
      font-size: 1.125rem;
    }

    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .highlight-box {
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .highlight-box.win {
      background: #ecfdf5;
      border: 2px solid #10b981;
      color: #065f46;
    }

    .highlight-box.loss {
      background: #fef2f2;
      border: 2px solid #ef4444;
      color: #7f1d1d;
    }

    .highlight-label {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
    }

    .highlight-amount {
      font-size: 1.75rem;
      font-weight: 700;
    }

    .highlight-player {
      font-size: 1rem;
      font-weight: 500;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .chart-card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: relative;
      height: 400px;
      display: flex;
      flex-direction: column;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      gap: 1rem;
    }

    .chart-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: #374151;
      flex: 1;
    }

    .download-btn {
      padding: 0.5rem 0.75rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.375rem;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .download-btn:hover {
      background: #2563eb;
    }

    .download-btn:active {
      background: #1d4ed8;
    }

    .player-filter {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 0.5rem;
    }

    .filter-controls {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .filter-btn {
      padding: 0.35rem 0.75rem;
      background: #e5e7eb;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: #d1d5db;
    }

    .filter-btn.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .player-checkboxes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .player-checkbox {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.85rem;
      cursor: pointer;
      user-select: none;
    }

    .player-checkbox input {
      cursor: pointer;
      accent-color: #3b82f6;
    }

    .player-checkbox span {
      color: #374151;
    }

    canvas {
      flex: 1;
      max-height: 100%;
    }

    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .chart-card {
        height: 350px;
      }
    }

    @media (max-width: 640px) {
      .stats-container {
        padding: 1rem;
      }

      .stats-grid {
        gap: 1rem;
      }

      .chart-card {
        padding: 1rem;
        height: 300px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'game-stats': GameStats;
  }
}
