/* Alpine root for the analyst dashboard. Two views (scoring, reinvest), one
   shared weights blob, one debounce timer. State + transport only — no DOM
   munging beyond the Chart.js donut handle. */

function dashboard() {
  return {
    view: 'scoring',

    tickerCount: 0,
    cacheMtime: '—',
    defaultWeights: null,
    weights: { buy: { categories: {}, signals: {} }, trim: { categories: {}, signals: {} }, risk: { maxPoints: {} } },
    rows: [],
    loading: false,
    sortKey: 'buy',
    sortDir: -1,

    reinvestCash: 10000,
    reinvestRows: [],
    donut: null,

    buySignalCodes:  ['A1','A2','A3','B1','B2','B3','C1','C2','C3','D1','D2'],
    trimSignalCodes: ['A1','A2','A3','B1','B2','B3','C1','C2'],
    riskSignalCodes: ['R1','R2','R3','R4','R5','R6','R7'],

    categoryLabels: {
      buy:  { A: 'Valuation', B: 'Technical', C: 'Sentiment', D: 'Dividend timing' },
      trim: { A: 'Stretched valuation', B: 'Technical breakdown', C: 'Sentiment fade' }
    },

    async init() {
      const r = await fetch('/api/tickers').then(x => x.json());
      this.tickerCount = r.count;
      this.cacheMtime = new Date(r.mtime).toISOString().slice(0, 10);
      this.defaultWeights = JSON.parse(JSON.stringify(r.defaultWeights));
      this.weights = JSON.parse(JSON.stringify(r.defaultWeights));
      await this.rescore();
    },

    onWeight(path, value) {
      // path e.g. "buy.signals.A1" or "buy.categories.A"
      const parts = path.split('.');
      let target = this.weights;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts[parts.length - 1]] = Number(value);
      this.debouncedRescore();
    },

    debouncedRescore() {
      clearTimeout(this._t);
      this._t = setTimeout(() => this.rescore(), 150);
    },

    async rescore() {
      this.loading = true;
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ weights: this.weights }),
        }).then(x => x.json());
        this.rows = res.rows;
      } finally {
        this.loading = false;
      }
    },

    resetWeights() {
      if (!this.defaultWeights) return;
      this.weights = JSON.parse(JSON.stringify(this.defaultWeights));
      this.rescore();
    },

    sortBy(key) {
      if (this.sortKey === key) this.sortDir *= -1;
      else { this.sortKey = key; this.sortDir = key === 'ticker' || key === 'companyName' || key === 'signal' ? 1 : -1; }
    },

    get sortedRows() {
      const k = this.sortKey, d = this.sortDir;
      return [...this.rows].sort((a, b) => {
        const av = a[k] ?? -Infinity, bv = b[k] ?? -Infinity;
        if (av < bv) return -1 * d;
        if (av > bv) return 1 * d;
        return 0;
      });
    },

    async loadReinvest() {
      const cash = Math.max(0, Number(this.reinvestCash) || 0);
      const r = await fetch(`/api/reinvest?cash=${cash}`).then(x => x.json());
      this.reinvestRows = r.allocations.filter(a => a.allocation > 0);
      this.renderDonut();
    },

    renderDonut() {
      const canvas = document.getElementById('reinvest-donut');
      if (!canvas) return;
      if (this.donut) this.donut.destroy();
      const data = this.reinvestRows.slice(0, 10);
      this.donut = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.ticker),
          datasets: [{
            data: data.map(d => d.allocation),
            backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#ef4444','#84cc16','#f97316','#a855f7'],
            borderColor: '#0e1014',
            borderWidth: 2,
          }],
        },
        options: {
          plugins: {
            legend: { position: 'right', labels: { color: '#e4e7ec', font: { size: 11 } } },
          },
        },
      });
    },
  };
}

// First-time reinvest render once Alpine wires up.
document.addEventListener('alpine:initialized', () => {
  const root = document.querySelector('[x-data]')._x_dataStack[0];
  setTimeout(() => root.loadReinvest(), 200);
});
