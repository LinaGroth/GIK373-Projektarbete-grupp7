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

document.addEventListener("DOMContentLoaded", function () {
  const readMoreLinks = document.querySelectorAll(".read-more");
  const modals = document.querySelectorAll(".modal");
  const closeButtons = document.querySelectorAll(".close-button");

  readMoreLinks.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      modals[index].style.display = "block";
    });
  });

  closeButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      modals[index].style.display = "none";
    });
  });

  // Stäng modalen om användaren klickar utanför modalinnehållet
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

  // Befolkning: antal personer per region
  const popValues = popData.data.map(d => Number(d.values[0]));

  // Vatten i 1000-tal kubikmeter per år — multiplicera med 1000 för kubikmeter
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

  // 👇 NYTT
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

// Initiera visualiseringar
createYearButtons();
updateMap(selectedYear);


//LINJEDIAGRAM
async function fetchNationalWaterUsageOverTime() {
  const xValues = []; // År
  const yValues = []; // Genomsnittligt liter/person

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
    title: ''  // Tom titel eftersom vi använder annotation istället
  },

  annotations: [
    {
      xref: 'paper',
      yref: 'paper',
      x: 0,      // Justera placeringen om det behövs
      y: 1.03,
      text: 'Liter/person',
      showarrow: false,
      font: {
        size: 12,
        color: '#1e2b39',
        family: 'M PLUS 1p, sans-serif'
      },
      textangle: 0,  // Horisontell text
      xanchor: 'center',
      yanchor: 'middle'
    }
  ],

  margin: { t: 100, b: 80, l: 110, r: 30 },  // Ökad vänstermarginal så annotationen inte klipps bort

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
  Plotly.newPlot('lineChart', [trace], layout);
}

drawNationalWaterUsageLineChart();


// FORMULÄR
document.getElementById('waterForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const form = event.target;

  const showerTime = Number(form.shower.value);
  const toiletUse = Number(form.toilet.value);
  const tapTime = Number(form.tap.value);
  const handwashTimes = Number(form.handwash.value);
  const dishwasherUse = form.dishwasher_use.value;
  const washingUse = form.washing.value;
  const hasSaver = form.saver.value === 'yes';

  // Standard vattenförbrukning per aktivitet (liter)
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

  const showerUsage = showerTime * waterPerMinShower * saverFactor;
  const toiletUsage = toiletUse * waterPerToiletFlush * saverFactor;
  const tapUsage = tapTime * waterPerMinTap * saverFactor;
  const handwashUsage = handwashTimes * waterPerHandwash * saverFactor;
  const dishwasherUsage = (dishwasherRunsPerWeek / 7) * waterPerDishwasherRun * saverFactor;
  const washingUsage = (washingRunsPerWeek / 7) * waterPerWashingRun * saverFactor;

  const totalUsage = showerUsage + toiletUsage + tapUsage + handwashUsage + dishwasherUsage + washingUsage;
  const yearlyUsage = totalUsage * 365;

  // 💬 Visa textresultat
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <h3>Din uppskattade dagliga vattenförbrukning per person är ca <strong>${totalUsage.toFixed(1)} liter</strong>.<br>
    Det motsvarar ungefär <strong>${yearlyUsage.toFixed(0)} liter per år</strong>.</h3>
  `;

  // 📊 Cirkeldiagramdata
  const values = [showerUsage, toiletUsage, tapUsage, handwashUsage, dishwasherUsage, washingUsage];
  const labels = ['Dusch', 'Toalett', 'Kran', 'Disk för hand', 'Diskmaskin', 'Tvätt'];
  const valueLabels = labels.map((label, i) => `${label}: ${values[i].toFixed(1)} liter`);

  const data = [{
    values: values,
    labels: valueLabels,
    type: 'pie',
    textinfo: 'label',
    hoverinfo: 'none', // ingen hoverinfo
    textposition: 'outside',
    automargin: false,
    marker: {
      colors: ['#c9e4ca', '#87bba2', '#55828b', '#3b6064', '#364958', '#011936']
    }
  }];

  const layout = {
    height: 400,
    width: 650,
    margin: { t: 0, b: 0, l: 0, r: 10 },
    showlegend: false,
    paper_bgcolor: '#f1f2f1',
    plot_bgcolor: '#f1f2f1'
  };

  Plotly.newPlot('pieChart', data, layout, { displayModeBar: false });

  document.getElementById('resultModal').style.display = 'block';
});

// 🔒 Stäng resultatmodulen
document.getElementById('closeResultBtn').addEventListener('click', function() {
  document.getElementById('resultModal').style.display = 'none';
});



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



  document.getElementById("openFormBtn").addEventListener("click", function() {
    document.getElementById("formModal").style.display = "block";
  });

  document.getElementById("closeFormBtn").addEventListener("click", function() {
    document.getElementById("formModal").style.display = "none";
  });
    document.getElementById("openFormBtn2").addEventListener("click", function() {
    document.getElementById("formModal").style.display = "block";
  });

  document.getElementById("closeFormBtn").addEventListener("click", function() {
    document.getElementById("formModal").style.display = "none";
  });


  // Klick utanför modalen stänger den
  window.addEventListener("click", function(event) {
    const modal = document.getElementById("formModal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });


  // Öppna resultatmodellen när man beräknar
function openResultModal() {
  document.getElementById("resultModal").style.display = "block";
}

// Stängmodalknapp
document.getElementById("closeResultBtn").addEventListener("click", function () {
  document.getElementById("resultModal").style.display = "none";
});

// Klick utanför rutan stänger modalen
window.addEventListener("click", function (event) {
  const modal = document.getElementById("resultModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

document.getElementById("waterForm").addEventListener("submit", function (event) {
  event.preventDefault(); // Hindrar sidan från att laddas om

  const form = event.target;
  const shower = parseFloat(form.shower.value) || 0;
  const toilet = parseFloat(form.toilet.value) || 0;
  const tap = parseFloat(form.tap.value) || 0;
  const handwash = parseInt(form.handwash.value) || 0;
  const dishwasherUse = form.dishwasher_use.value;
  const washing = form.washing.value;
  const saver = form.saver.value;

  // Omvandla veckovisa användningar till dagligt snitt
  const dishwasherDaily = dishwasherUse === "1-2" ? 1.5 / 7 :
                          dishwasherUse === "3-5" ? 4 / 7 :
                          dishwasherUse === "6-10" ? 8 / 7 : 0;

  const washingDaily = washing === "1-2" ? 1.5 / 7 :
                       washing === "3-5" ? 4 / 7 :
                       washing === "6-10" ? 8 / 7 : 0;

  // Vattenförbrukning i liter
  let totalUsage = 0;
  let usageBreakdown = {};

  const showerUsage = shower * (saver === "yes" ? 6 : 12); // liter per minut
  const toiletUsage = toilet * (saver === "yes" ? 4 : 6);  // liter per spolning
  const tapUsage = tap * 6;                               // liter per minut
  const handwashUsage = handwash * 15;
  const dishwasherUsage = dishwasherDaily * 12;
  const washingUsage = washingDaily * 50;

  totalUsage = showerUsage + toiletUsage + tapUsage + handwashUsage + dishwasherUsage + washingUsage;

  usageBreakdown = {
    "Dusch": showerUsage,
    "Toalett": toiletUsage,
    "Kran": tapUsage,
    "Diska för hand": handwashUsage,
    "Diskmaskin": dishwasherUsage,
    "Tvättmaskin": washingUsage
  };

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <h3>Din uppskattade dagliga vattenförbrukning per person är ca <strong>${totalUsage.toFixed(1)} liter</strong>.</h3>
  `;

  // Visa resultatmodellen
  openResultModal();

  // Rita cirkeldiagram
  drawPieChart(usageBreakdown);
});

function drawPieChart(dataObject) {
  const data = google.visualization.arrayToDataTable([
    ['Aktivitet', 'Liter'],
    ...Object.entries(dataObject)
  ]);

  const options = {
    title: 'Fördelning av vattenanvändning',
    pieHole: 0.4,
    width: '100%',
    height: 300,
    chartArea: { width: '90%', height: '80%' },
    legend: { position: 'bottom' }
  };

  const chart = new google.visualization.PieChart(document.getElementById('pieChart'));
  chart.draw(data, options);
}


