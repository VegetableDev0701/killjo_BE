const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Read logo file directly
const logoPath = path.join(__dirname, '../../assets/nodo_logo.svg');
let logoSvg = '';
try {
    if (fs.existsSync(logoPath)) {
        logoSvg = fs.readFileSync(logoPath, 'utf8');
    }
} catch (e) {
    console.warn('Logo file not found or readable:', e);
}

/**
 * Data Normalization
 */
function normalizeTrending(data) {
    return data.map(d => ({
        category: d.category,
        searchCount: Number(d.searchCount) || 0,
        percentageIncrease: typeof d.percentageIncrease === 'number' ? d.percentageIncrease : null
    }));
}

function normalizeTopSearches(data) {
    return data.map(d => ({
        searchTerm: d.searchTerm,
        searchCount: Number(d.searchCount) || 0,
        percentageIncrease: typeof d.percentageIncrease === 'number' ? d.percentageIncrease : null
    }));
}

function normalizeClicks(data) {
    return data.map(d => ({
        category: d.category || 'Unknown',
        clickCount: Number(d.clickCount) || 0,
        searchCount: Number(d.searchCount) || 0,
        percentageIncrease: typeof d.percentageIncrease === 'number' ? d.percentageIncrease : null
    }));
}

function normalizeLocations(data) {
    return data.map(d => ({
        city: d.city || 'Unknown',
        searchCount: Number(d.searchCount) || 0,
        percentageIncrease: typeof d.percentageIncrease === 'number' ? d.percentageIncrease : null
    }));
}

/**
 * Localization Dictionary
 */
const translations = {
    en: {
        title: "Nodo — Market Insight Report",
        generatedOn: "Generated on",
        analysisPeriod: "Analysis Period",
        trendingCategories: "Trending Categories",
        topSearches: "Top Searches",
        topLocations: "Top Locations by Activity",
        categoryPerformance: "Category Performance: Clicks vs Searches",
        aiInsights: "SUMMARY",
        suggestedOpportunities: "Suggested Opportunities",
        noTrending: "No trending data available.",
        noSearch: "No search query data available.",
        noClick: "No click data available.",
        noLocation: "No location data available.",
        trendingSummary: (count, total, topCat, topCount) =>
            `Analysis of <strong>${count}</strong> categories reveals <strong>${total}</strong> total searches. <strong>"${topCat}"</strong> leads with <strong>${topCount}</strong> searches.`,
        topSearchSummary: (topTerm, topCount, uniqueCount) =>
            `The most frequent search term is <strong>"${topTerm}"</strong> with <strong>${topCount}</strong> queries.`,
        clickSummary: (totalClicks, topCat, topCount) =>
            `Users generated <strong>${totalClicks}</strong> clicks across categories. <strong>"${topCat}"</strong> received the most engagement with <strong>${topCount}</strong> clicks.`,
        locationSummary: (topCity, topCount, uniqueCount) =>
            `Most active searches originated from <strong>"${topCity}"</strong> with <strong>${topCount}</strong> queries.`
    },
    es: {
        title: "Nodo — Reporte de Mercado",
        generatedOn: "Generado el",
        analysisPeriod: "Periodo de Análisis",
        trendingCategories: "Categorías en Tendencia",
        topSearches: "Búsquedas Principales",
        topLocations: "Ubicaciones con más Actividad",
        categoryPerformance: "Rendimiento: Clics vs Búsquedas",
        aiInsights: "SUMMARY",
        suggestedOpportunities: "Oportunidades Sugeridas",
        noTrending: "No hay datos de tendencias disponibles.",
        noSearch: "No hay datos de búsqueda disponibles.",
        noClick: "No hay datos de clics disponibles.",
        noLocation: "No hay datos de ubicación disponibles.",
        trendingSummary: (count, total, topCat, topCount) =>
            `El análisis de <strong>${count}</strong> categorías revela <strong>${total}</strong> búsquedas totales. <strong>"${topCat}"</strong> lidera con <strong>${topCount}</strong> búsquedas.`,
        topSearchSummary: (topTerm, topCount, uniqueCount) =>
            `El término más buscado es <strong>"${topTerm}"</strong> con <strong>${topCount}</strong> consultas.`,
        clickSummary: (totalClicks, topCat, topCount) =>
            `Los usuarios generaron <strong>${totalClicks}</strong> clics en categorías. <strong>"${topCat}"</strong> tuvo la mayor participación con <strong>${topCount}</strong> clics.`,
        locationSummary: (topCity, topCount, uniqueCount) =>
            `La mayoría de las búsquedas activas se originaron en <strong>"${topCity}"</strong> con <strong>${topCount}</strong> consultas.`
    }
};

/**
 * Summary Generators with Localization
 */
function generateTrendingSummary(data, t) {
    if (!data.length) return t.noTrending;
    const total = data.reduce((sum, d) => sum + d.searchCount, 0);
    const top = [...data].sort((a, b) => b.searchCount - a.searchCount)[0];
    return t.trendingSummary(data.length, total, top.category, top.searchCount);
}

function generateTopSearchSummary(data, t) {
    if (!data.length) return t.noSearch;
    const top = data[0];
    return t.topSearchSummary(top.searchTerm, top.searchCount, data.length);
}

function generateClickSummary(data, t) {
    if (!data.length) return t.noClick;
    const totalClicks = data.reduce((sum, d) => sum + d.clickCount, 0);
    const topClick = [...data].sort((a, b) => b.clickCount - a.clickCount)[0];
    return t.clickSummary(totalClicks, topClick.category, topClick.clickCount);
}

function generateLocationSummary(data, t) {
    if (!data.length) return t.noLocation;
    const top = data[0];
    return t.locationSummary(top.city, top.searchCount, data.length);
}

/**
 * Build HTML template
 */
function buildHTML({ trending, topSearches, clicks, locations, period, language = 'en', aiInsights }) {
    const t = translations[language] || translations.en;
    console.log("PERIOD IS : ", period)

    // summaries
    const sumTrending = generateTrendingSummary(trending, t);
    const sumTop = generateTopSearchSummary(topSearches, t);
    const sumClicks = generateClickSummary(clicks, t);
    const sumLocations = generateLocationSummary(locations, t);

    // AI Content (Formatted HTML expected)
    const insightsHtml = aiInsights?.insights || "<p>Unavailable</p>";
    const opportunitiesHtml = aiInsights?.opportunities || "<p>Unavailable</p>";

    // Chart 1: Trending
    const tData = trending.slice(0, 18);
    const tLabels = tData.map(d => d.category);
    const tCounts = tData.map(d => d.searchCount);
    const tPcts = tData.map(d => d.percentageIncrease);
    // Dynamic height: ~50px per bar + header/footer space. Min 150px.
    const tHeight = Math.max(150, tData.length * 35 + 30);

    // Chart 2: Clicks vs Search
    const cData = clicks.slice(0, 18);
    const cLabels = cData.map(d => d.category);
    const cClicks = cData.map(d => d.clickCount);
    const cSearches = cData.map(d => d.searchCount);
    const cPcts = cData.map(d => d.percentageIncrease);
    const cHeight = Math.max(150, cData.length * 45 + 45);

    // Chart 3: Top Searches
    const sData = topSearches.slice(0, 35);
    const sLabels = sData.map(d => d.searchTerm);
    const sCounts = sData.map(d => d.searchCount);
    const sPcts = sData.map(d => d.percentageIncrease);
    const sHeight = Math.max(150, sData.length * 24 + 24);

    // Chart 4: Top Locations
    const lData = locations.slice(0, 30);
    const lLabels = lData.map(d => d.city);
    const lCounts = lData.map(d => d.searchCount);
    const lPcts = lData.map(d => d.percentageIncrease);
    const lHeight = Math.max(150, lData.length * 27 + 27);



    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${t.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    :root { --primary: #2563eb; --width-max: 900px; }
    body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1e293b; background: #fff; }
    .header {
        background-color: #000;
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .logo-container {
        width: 60px;
    }
    .logo-container svg {
        width: 100%;
        height: auto;
    }
    .report-meta {
        text-align: right;
        color: #fff;
    }
    .container { max-width: 100%; padding: 30px 50px; }
    h1 { font-size: 28px; text-align: center; margin-bottom: 8px; }
    .date { text-align: center; color: #64748b; margin-bottom: 10px; }
    .period { text-align: center; margin-bottom: 10px; }
    .section { margin-bottom: 60px; page-break-inside: avoid; padding-top: 40px; }
    h2 { font-size: 20px; border-left: 5px solid var(--primary); padding-left: 15px; margin-bottom: 20px; color: #0f172a; }
    .summary-box { background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; line-height: 1.6; }
    .chart-box { position: relative; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background: #fff; box-sizing: border-box; }
    .insight-section { background: #eff6ff; border: 1px solid #dbeafe; padding: 25px; border-radius: 12px; margin-bottom: 40px; margin-top: 50px;}
    .insight-section h3 { margin-top: 0; color: #1e40af; display: flex; align-items: center; gap: 10px; }
    .insight-text { color: #1e3a8a; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
        ${logoSvg}
    </div>
    <div class="report-meta">
        <div style="font-size: 14px; opacity: 0.8;">${t.generatedOn} ${new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</div>
        <div style="font-size: 14px; opacity: 0.8; margin-top: 5px;">${t.analysisPeriod}: <strong>${period}</strong></div>
    </div>
  </div>

  <div class="container">
    <h1>${t.title}</h1>
    <!-- 1. Trending Categories -->
    <div class="section">
      <h2>${t.trendingCategories}</h2>
      <div class="summary-box">${sumTrending}</div>
      <div class="chart-box" style="height: ${tHeight}px">
        <canvas id="chartTrending"></canvas>
      </div>
    </div>

    <!-- 2. Category Clicks vs Searches -->
    <div class="section">
      <h2>${t.categoryPerformance}</h2>
      <div class="summary-box">${sumClicks}</div>
      <div class="chart-box" style="height: ${cHeight}px">
        <canvas id="chartClicks"></canvas>
      </div>
    </div>

    <!-- 3. Top Searches -->
    <div class="section">
      <h2>${t.topSearches}</h2>
      <div class="summary-box">${sumTop}</div>
      <div class="chart-box" style="height: ${sHeight}px">
        <canvas id="chartSearches"></canvas>
      </div>
    </div>

    <!-- 4. Top Locations -->
    <div class="section">
      <h2>${t.topLocations}</h2>
      <div class="summary-box">${sumLocations}</div>
      <div class="chart-box" style="height: ${lHeight}px">
        <canvas id="chartLocations"></canvas>
      </div>
    </div>

    <!-- 5. AI Insights -->
    <div class="insight-section" style="page-break-before: always;">
      <h3>${t.aiInsights}</h3>
      <div class="insight-text">
        ${insightsHtml}
      </div>
    </div>

    <!-- 6. Suggested Opportunity -->
    <div class="insight-section" style="background: #f0fdf4; border-color: #bbf7d0;">
      <h3 style="color: #166534;">${t.suggestedOpportunities}</h3>
      <div class="insight-text" style="color: #14532d;">
        ${opportunitiesHtml}
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
  <script>
    Chart.register(ChartDataLabels);
    
    const commonOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { right: 60 } },
      scales: {
        x: { beginAtZero: true, grid: { display: true } },
        y: { grid: { display: false } }
      }
    };

    const labelPlugin = (pcts) => ({
      color: '#334155',
      anchor: 'end',
      align: 'end',
      offset: 4,
      font: { weight: 'bold', size: 11 },
      formatter: (val, ctx) => {
        if(!pcts) return val; // fallback
        const p = pcts[ctx.dataIndex];
        if (p == null) return '';
        return (p > 0 ? '▲' : (p < 0 ? '▼' : '')) + Math.abs(p) + '%';
      }
    });

    // Chart 1: Trending
    new Chart(document.getElementById('chartTrending'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(tLabels)},
        datasets: [{
          label: 'Search Count',
          data: ${JSON.stringify(tCounts)},
          backgroundColor: '#3b82f6',
          borderRadius: 3,
          maxBarThickness: 25
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { display: false },
          datalabels: labelPlugin(${JSON.stringify(tPcts)})
        }
      }
    });

    // Chart 2: Clicks (Multi-bar)
    const clickPercentages = ${JSON.stringify(cPcts)};

    new Chart(document.getElementById('chartClicks'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(cLabels)},
        datasets: [
          {
            label: 'Clicks',
            data: ${JSON.stringify(cClicks)},
            backgroundColor: '#10b981',
            borderRadius: 3,
            maxBarThickness: 25,
            datalabels: {
               color: '#334155',
               anchor: 'end',
               align: 'end',
               formatter: (val, ctx) => {
                 const pct = clickPercentages[ctx.dataIndex];
                 let label = val;
                 if (pct !== null && pct !== undefined) {
                   const sign = pct > 0 ? '▲' : (pct < 0 ? '▼' : '');
                   label += ' (' + sign + Math.abs(pct) + '%)';
                 }
                 return label;
               }
            }
          },
          {
            label: 'Searches',
            data: ${JSON.stringify(cSearches)},
            backgroundColor: '#64748b',
            borderRadius: 3,
            maxBarThickness: 25,
            datalabels: {
              color: '#334155',
              anchor: 'end',
              align: 'end',
              formatter: (val) => val > 0 ? val : ''
            }
          }
        ]
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { position: 'top', align: 'end' },
          // Global datalabels config is overridden by dataset config above
        }
      }
    });

    // Chart 3: Top Searches
    new Chart(document.getElementById('chartSearches'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(sLabels)},
        datasets: [{
          label: 'Count',
          data: ${JSON.stringify(sCounts)},
          backgroundColor: '#8b5cf6',
          borderRadius: 3,
          maxBarThickness: 25
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { display: false },
          datalabels: labelPlugin(${JSON.stringify(sPcts)})
        }
      }
    });

    // Chart 4: Top Locations
    new Chart(document.getElementById('chartLocations'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(lLabels)},
        datasets: [{
          label: 'Search Count',
          data: ${JSON.stringify(lCounts)},
          backgroundColor: '#f59e0b',
          borderRadius: 3,
          maxBarThickness: 25
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          legend: { display: false },
          datalabels: labelPlugin(${JSON.stringify(lPcts)})
        }
      }
    });

  </script>
</body>
</html>
    `;
}

function generateReportHtml(trendingData, topSearchesData, clicksData, locationStats, period, language, aiInsights) {
    return buildHTML({
        trending: normalizeTrending(trendingData),
        topSearches: normalizeTopSearches(topSearchesData),
        clicks: normalizeClicks(clicksData),
        locations: normalizeLocations(locationStats),
        period: period,
        language: language,
        aiInsights: aiInsights
    });
}

async function generateReportPdf(trendingData, topSearchesData, clicksData, locationStats, period, language = 'en', aiInsights = null) {
    const html = generateReportHtml(trendingData, topSearchesData, clicksData, locationStats, period, language, aiInsights);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();
        // Set high resolution for charts
        await page.setViewport({ width: 800, height: 1400, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        });
        return pdfBuffer;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { generateReportPdf };
