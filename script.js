/* Grupp 7 - Sanna Ehnlund, Lina Groth, Svea Bjöörn  */
const regionCodes = {
  '01': 'Stockholm', '03': 'Uppsala', '04': 'Södermanland', '05': 'Östergötland',
  '06': 'Jönköping', '07': 'Kronoberg', '08': 'Kalmar', '09': 'Gotland',
  '10': 'Blekinge', '12': 'Skåne', '13': 'Halland', '14': 'Västra Götaland',
  '17': 'Värmland', '18': 'Örebro', '19': 'Västmanland', '20': 'Dalarna',
  '21': 'Gävleborg', '22': 'Västernorrland', '23': 'Jämtland',
  '24': 'Västerbotten', '25': 'Norrbotten'
};

const waterHouseholdURL = "https://api.scb.se/OV0104/v1/doris/sv/ssd/START/MI/MI0902/MI0902E/VattenAnvHus";
const popStatisticsURL = "https://api.scb.se/OV0104/v1/doris/sv/ssd/START/BE/BE0101/BE0101A/BefolkningNy";

const baseRegions = Object.keys(regionCodes);

const basePopQuery = {
  query: [
    { code: "Region", selection: { filter: "vs:RegionLän07", values: baseRegions } },
    { code: "ContentsCode", selection: { filter: "item", values: ["BE0101N1"] } },
    { code: "Tid", selection: { filter: "item", values: [] } }
  ],
  response: { format: "JSON" }
};

const baseWaterQuery = {
  query: [
    {
      code: "Region",
      selection: {
        filter: "vs:RegionLän07",
        values: baseRegions
      }
    },
    {
      code: "VattenforsTyp",
      selection: {
        filter: "item",
        values: ["HTOT"]  
      }
    },
    {
      code: "Tid",
      selection: {
        filter: "item",
        values: []
      }
    }
  ],
  response: { format: "JSON" }
};

const years = ["2000", "2005", "2010", "2015", "2020"];
let selectedYear = "2020";
const yearButtonsContainer = document.getElementById('yearButtons');

function setActiveButton(year) {
  const buttons = yearButtonsContainer.querySelectorAll('button');
  buttons.forEach(btn => btn.classList.toggle('active', btn.textContent === year));
}

function updateMap(year) {
  displayWaterHouseholdDataOnMap(year);
}

function createYearButtons() {
  yearButtonsContainer.innerHTML = '';
  years.forEach(year => {
    const btn = document.createElement('button');
    btn.textContent = year;
    if (year === selectedYear) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (selectedYear !== year) {
        selectedYear = year;
        setActiveButton(year);
        updateMap(year);
      }
    });
    yearButtonsContainer.appendChild(btn);
  });
}

// Läs mer-knapp
document.addEventListener("DOMContentLoaded", function () {
  const readMoreLinks = document.querySelectorAll(".read-more");
  const modals = document.querySelectorAll(".modal");
  const closeButtons = document.querySelectorAll(".close-button");

  readMoreLinks.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      modals[index].style.display = "flex";
    });
  });

  closeButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      modals[index].style.display = "none";
    });
  });

  // Stäng modalen vid klick utanför
  window.addEventListener("click", (event) => {
    modals.forEach((modal) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });
  });
});

async function calculateWaterPerPerson(year) {
  const popQuery = structuredClone(basePopQuery);
  const waterQuery = structuredClone(baseWaterQuery);

  popQuery.query[2].selection.values = [year];
  waterQuery.query[2].selection.values = [year];

  const [popData, waterData] = await Promise.all([
    fetch(popStatisticsURL, { method: "POST", body: JSON.stringify(popQuery) }).then(res => res.json()),
    fetch(waterHouseholdURL, { method: "POST", body: JSON.stringify(waterQuery) }).then(res => res.json())
  ]);

  console.log("Populationsdata:", popData.data);
  console.log("Vattendata:", waterData.data);

  // Befolkning, antal personer per region
  const popValues = popData.data.map(d => Number(d.values[0]));

  // Vatten i 1000-tal kubikmeter per år, multiplicera med 1000 för kubikmeter
  const waterValues = waterData.data.map(d => Number(d.values[0]) * 1000);

  // Kubikmeter vatten per person och år
  const waterPerPersonM3 = waterValues.map((val, i) => popValues[i] > 0 ? val / popValues[i] : 0);

  // Omvandla kubikmeter till liter (1 m3 = 1000 liter)
  const waterPerPersonLiters = waterPerPersonM3.map(val => val * 1000);

  // Regionnamn enligt regionkoder
  const regions = waterData.data.map(d => regionCodes[d.key[0]]);

  return { regions, waterPerPersonM3, waterPerPersonLiters };
}

async function displayWaterHouseholdDataOnMap(year) {
  const mapData = await calculateWaterPerPerson(year);

  const data = [{
    type: 'choroplethmap',
    locations: mapData.regions,
    z: mapData.waterPerPersonLiters,
    featureidkey: 'properties.name',
    geojson: 'https://raw.githubusercontent.com/okfse/sweden-geojson/refs/heads/master/swedish_regions.geojson',
    colorbar: {
      title: { text: 'Liter/person och år', lenmode: 'pixels', len: 150, x: 0.95 }
    },
    colorscale: [
      [0, '#bfdde3'],
      [0.5, '#1b4a5f'],
      [1, '#1e2b39']
    ],
    hovertemplate:
      '<b>%{location}</b><br>' +
      'Vattenförbrukning: %{z:.0f} liter/person och år<br>' +
      '<extra></extra>'
  }];

  const layout = {
  map: {
    center: { lon: 17.3, lat: 63 },
    zoom: 3.3,
    projection: { type: 'mercator' },
    bgcolor: '#f1f2f1',
  },
  geo: {
    scope: 'europe',
    projection: { type: 'mercator' },
    fitbounds: 'locations',
    resolution: 50,
    lataxis: { range: [54.5, 69] },
    lonaxis: { range: [10, 25.5] },
    showcountries: false,
    showcoastlines: false,
    showland: true,
  },
  margin: { t: 10, b: 10, l: 10, r: 10 },
  font: {
    family: 'M PLUS 1p, sans-serif',
    size: 11,
    color: '#333',
  },
  paper_bgcolor: '#f1f2f1',
  plot_bgcolor: '#f1f2f1',

 
  hoverlabel: {
    bgcolor: 'rgba(27, 74, 95, 0.9)',
    bordercolor: '#1b4a5f',
    font: {
      size: 13,
      family: 'M PLUS 1p, sans-serif',
      color: '#ffffff'
    },
    padding: 12,
    namelength: -1
  }
};

  const config = {
    scrollZoom: false,
    displayModeBar: false
  };

  Plotly.newPlot('waterHouseholdStatistics', data, layout, config);
}

createYearButtons();
updateMap(selectedYear);

//LINJEDIAGRAM
async function fetchNationalWaterUsageOverTime() {
  const xValues = []; 
  const yValues = []; 

  for (const year of years) {
    const result = await calculateWaterPerPerson(year);
    const { waterPerPersonLiters } = result;

    const total = waterPerPersonLiters.reduce((sum, val) => sum + val, 0);
    const avg = total / waterPerPersonLiters.length;

    xValues.push(year);
    yValues.push(avg);
  }

  return { xValues, yValues };
}

async function drawNationalWaterUsageLineChart() {
  const data = await fetchNationalWaterUsageOverTime();

  const percentChanges = data.yValues.map((val, i, arr) => {
    if (i === 0) return 'N/A';
    return ((val - arr[i - 1]) / arr[i - 1] * 100).toFixed(2) + '%';
  });

  const trace = {
    x: data.xValues,
    y: data.yValues,
    type: 'scatter',
    mode: 'lines+markers',
    fill: 'tozeroy',
    fillcolor: 'rgba(27, 74, 95, 0.2)',
    line: {
      width: 6,
      shape: 'spline',
      color: 'rgba(27, 74, 95, 1)'
    },
    marker: {
      size: 14,
      color: '#bfdde3',
      line: { width: 1, color: '#ffffff' }
    },
    name: 'Vattenanvändning per person',
    hovertemplate:
      '<b>%{x}</b><br>' +
      '%{y:.0f} liter/person<br>' +
      'Förändring: %{customdata}<extra></extra>',
    customdata: percentChanges
  };

const layout = {
  xaxis: {
    title: {
      text: 'År',
      font: { size: 12, color: '#495057' },
      standoff: 20,
    },
    tickfont: { size: 12, color: '#495057' },
    showgrid: false,
    showline: true,
    linecolor: '#ced4da'
  },

  yaxis: {
    showline: true,
    zeroline: false,
    gridcolor: 'rgba(0,0,0,0.05)',
    tickfont: { size: 12, color: '#495057' },
    linecolor: '#ced4da',
    title: ''  
  },

  annotations: [
    {
      xref: 'paper',
      yref: 'paper',
      x: 0,      
      y: 1.03,
      text: 'Liter/person',
      showarrow: false,
      font: {
        size: 12,
        color: '#1e2b39',
        family: 'M PLUS 1p, sans-serif'
      },
      textangle: 0, 
      xanchor: 'center',
      yanchor: 'middle'
    }
  ],

  margin: { t: 100, b: 80, l: 110, r: 30 },  

  plot_bgcolor: '#f1f2f1',
  paper_bgcolor: '#f1f2f1',

  font: {
    family: 'M PLUS 1p, sans-serif',
    color: '#1e1e1e'
  },

  hoverlabel: {
    bgcolor: 'rgba(27, 74, 95, 0.9)',
    bordercolor: '#1b4a5f',
    font: {
      size: 13,
      family: 'M PLUS 1p, sans-serif',
      color: '#ffffff'
    },
    padding: 12,
    namelength: -1
  }
};
  const config = { responsive: true };
  Plotly.newPlot('lineChart', [trace], layout, config);

}

drawNationalWaterUsageLineChart();


/* HEADER/MENY */

  function toggleMenu() {
    const menu = document.getElementById("mobileMenu");
    menu.classList.toggle("show");
  }

/* FOOTER */
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.querySelector('.dropdown-toggle');
  const menu = document.querySelector('.dropdown-menu');

  toggle.addEventListener('click', function () {
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
  });

  // Klick utanför dropdown stänger den
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.footer-dropdown')) {
      menu.style.display = 'none';
    }
  });
});

document.getElementById("openFormBtn").addEventListener("click", () => {
  document.getElementById("formModal").style.display = "block";
});
document.getElementById("closeFormBtn").addEventListener("click", () => {
  document.getElementById("formModal").style.display = "none";
});

window.addEventListener("click", (event) => {
  const formModal = document.getElementById("formModal");
  const resultModal = document.getElementById("resultModal");

  if (event.target === formModal) {
    formModal.style.display = "none";
  }
  if (event.target === resultModal) {
    resultModal.style.display = "none";
  }
});

document.getElementById("waterForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const form = event.target;

  const showerTime = Number(form.shower.value) || 0;
  const toiletUse = Number(form.toilet.value) || 0;
  const tapTime = Number(form.tap.value) || 0;
  const handwashTimes = Number(form.handwash.value) || 0;
  const dishwasherUse = form.dishwasher_use.value;
  const washingUse = form.washing.value;
  const hasSaver = form.saver.value === 'yes';

  const waterPerMinShower = 9;
  const waterPerToiletFlush = 6;
  const waterPerMinTap = 5;
  const waterPerHandwash = 15;
  const waterPerDishwasherRun = 12;
  const waterPerWashingRun = 50;
  const saverFactor = hasSaver ? 0.7 : 1;

  function parseWeeklyCount(value) {
    switch(value) {
      case '0': return 0;
      case '1-2': return 1.5;
      case '3-5': return 4;
      case '6-10': return 8;
      default: return 0;
    }
  }

  const dishwasherRunsPerWeek = parseWeeklyCount(dishwasherUse);
  const washingRunsPerWeek = parseWeeklyCount(washingUse);

  // Beräkna vattenförbrukning per dag
  const showerUsage = showerTime * waterPerMinShower * saverFactor;
  const toiletUsage = toiletUse * waterPerToiletFlush * saverFactor;
  const tapUsage = tapTime * waterPerMinTap * saverFactor;
  const handwashUsage = handwashTimes * waterPerHandwash * saverFactor;
  const dishwasherUsage = (dishwasherRunsPerWeek / 7) * waterPerDishwasherRun * saverFactor;
  const washingUsage = (washingRunsPerWeek / 7) * waterPerWashingRun * saverFactor;

  const totalUsage = showerUsage + toiletUsage + tapUsage + handwashUsage + dishwasherUsage + washingUsage;
  const yearlyUsage = totalUsage * 365;

  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <h3>Din uppskattade dagliga vattenförbrukning per person är ca <strong>${totalUsage.toFixed(1)} liter</strong>.<br>
    Det motsvarar ungefär <strong>${yearlyUsage.toFixed(0)} liter per år</strong>.</h3>
  `;

  const values = [showerUsage, toiletUsage, tapUsage, handwashUsage, dishwasherUsage, washingUsage];
  const labels = ['Dusch', 'Toalett', 'Kran', 'Disk för hand', 'Diskmaskin', 'Tvätt'];
  const valueLabels = labels.map((label, i) => `${label}: ${values[i].toFixed(1)} liter`);

  const data = [{
    values: values,
    labels: valueLabels,
    type: 'pie',
    textinfo: 'label',
    hoverinfo: 'none',
    textposition: 'outside',
    automargin: false,
    marker: {
      colors: ['#c9e4ca', '#87bba2', '#55828b', '#3b6064', '#364958', '#011936']
    }
  }];

  const layout = {
    height: 350,
    width: 650,
    margin: { t: 60, b: 60, l: 0, r: 60 },
    showlegend: false,
    paper_bgcolor: '#f1f2f1',
    plot_bgcolor: '#f1f2f1'
  };

  Plotly.newPlot('pieChart', data, layout, { displayModeBar: false });
  
  const tipsContainer = document.getElementById('tipsContainer');
  tipsContainer.innerHTML = `
    <h3>Tips för att minska din vattenförbrukning:</h3>
    <ul>
      <li>Ta kortare duschar för att spara vatten och stäng av vattnet när du tvålar in dig</li>
      <li>Stäng av vattnet när du tvålar in dig vid handtvätt.</li>
      <li>Införskaffa snålspolande toalett och/eller duschmunstycke.</li>
      <li>Kör diskmaskin och tvättmaskin endast när de är fulla.</li>
      <li>Spara regnvatten för att vattna trädgården.</li>
      <li>Reparera läckor snabbt för att undvika spill.</li>
      <li>Diska i balja istället för under rinnande vatten.</li>
      <li>Tvätta bara när det verkligen behövs, ofta räcker det med att vädra kläderna.</li>
    </ul>
  `;

  document.getElementById("formModal").style.display = "none";
  document.getElementById("resultModal").style.display = "flex";
});

document.getElementById('closeResultBtn').addEventListener('click', () => {
  document.getElementById('resultModal').style.display = 'none';
});
