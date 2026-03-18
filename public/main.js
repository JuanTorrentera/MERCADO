let chartBar = null;
let chartLine = null;
let moduloActual = 'tarifas';

const COLUMNAS_META = ['Año', 'Mes', 'Día', 'Fecha', 'Hora', 'HoraOperacion', 'Tarifa', 'Division', 'Concepto', 'Zona', 'Sistema', 'ZonaReserva', 'ZonaCarga'];

document.addEventListener('DOMContentLoaded', () => {
    cargarFiltros(moduloActual);
    
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            moduloActual = e.target.getAttribute('data-modulo');
            document.getElementById('titulo-modulo').textContent = e.target.textContent;
            
            // Ocultar KPIs en Tarifas según tu observación
            const kpiSection = document.querySelector('.kpi-container');
            if(moduloActual === 'tarifas') {
                kpiSection.style.display = 'none';
            } else {
                kpiSection.style.display = 'grid';
            }
            
            cargarFiltros(moduloActual);
        });
    });

    document.getElementById('btn-graficar').addEventListener('click', graficarDatos);
});

async function cargarFiltros(modulo) {
    const contenedor = document.getElementById('contenedor-filtros');
    contenedor.innerHTML = '<p style="color:white">Cargando filtros...</p>';
    try {
        const res = await fetch(`/api/filtros?modulo=${modulo}`);
        const filtros = await res.json();
        contenedor.innerHTML = '';
        for (const [col, ops] of Object.entries(filtros)) {
            const div = document.createElement('div');
            div.className = 'filtro-grupo';
            div.innerHTML = `<label>${col}</label><select id="f-${col}" data-col="${col}"><option value="">Todos</option></select>`;
            const select = div.querySelector('select');
            ops.forEach(o => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = o;
                select.appendChild(opt);
            });
            contenedor.appendChild(div);
        }
    } catch (err) { console.error(err); }
}

async function graficarDatos() {
    const params = new URLSearchParams({ modulo: moduloActual });
    document.querySelectorAll('.filtros-container select').forEach(s => {
        if(s.value) params.append(s.dataset.col, s.value);
    });

    try {
        const res = await fetch(`/api/datos?${params.toString()}`);
        const datos = await res.json();
        if (!datos || datos.length === 0) return alert('No se encontraron registros.');
        
        renderizarDash(datos);
    } catch (err) { console.error(err); }
}

function renderizarDash(datos) {
    const llaves = Object.keys(datos[0]);
    const metricas = llaves.filter(k => !COLUMNAS_META.includes(k.trim()) && !isNaN(parseFloat(datos[0][k])));

    // 1. Actualizar KPIs (Excepto en tarifas)
    if(moduloActual !== 'tarifas') {
        let globalMax = -Infinity;
        let globalMin = Infinity;
        let sumTotal = 0;
        let count = 0;

        datos.forEach(d => {
            metricas.forEach(m => {
                const v = parseFloat(d[m] || 0);
                if(v > globalMax) globalMax = v;
                if(v < globalMin) globalMin = v;
                sumTotal += v;
                count++;
            });
        });

        document.getElementById('kpi-avg').textContent = (sumTotal / count).toFixed(2);
        document.getElementById('kpi-max').textContent = globalMax.toFixed(2);
        document.getElementById('kpi-min').textContent = globalMin.toFixed(2);
        document.getElementById('kpi-count').textContent = datos.length;
    }

    // 2. Lógica de Agrupación Temporal
    const uniqueMes = new Set(datos.map(d => d.Mes));
    const uniqueDia = new Set(datos.map(d => d.Día));
    let ejeX = 'Mes';

    if (llaves.includes('HoraOperacion')) {
        if (uniqueMes.size === 1 && uniqueDia.size === 1) ejeX = 'HoraOperacion';
        else if (uniqueMes.size === 1) ejeX = 'Día';
    }

    const agrupado = {};
    datos.forEach(item => {
        const xVal = item[ejeX];
        if (!agrupado[xVal]) {
            agrupado[xVal] = { count: 0 };
            metricas.forEach(m => agrupado[xVal][m] = 0);
        }
        agrupado[xVal].count += 1;
        metricas.forEach(m => agrupado[xVal][m] += parseFloat(item[m] || 0));
    });

    const labelsX = Object.keys(agrupado).sort((a, b) => parseFloat(a) - parseFloat(b));
    
    // 3. Renderizar Gráfica de Evolución (Líneas para TODAS las componentes)
    const ctxLine = document.getElementById('graficaMensual').getContext('2d');
    if(chartLine) chartLine.destroy();

    const colores = ['#38bdf8', '#22c55e', '#fbbf24', '#f87171', '#a855f7', '#ec4899', '#6366f1'];
    
    const datasets = metricas.map((m, i) => ({
        label: m,
        data: labelsX.map(l => (agrupado[l][m] / agrupado[l].count).toFixed(4)),
        borderColor: colores[i % colores.length],
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 2
    }));

    chartLine = new Chart(ctxLine, {
        type: 'line',
        data: { labels: labelsX.map(l => ejeX === 'HoraOperacion' ? `${l}:00` : (ejeX === 'Día' ? `Día ${l}` : `Mes ${l}`)), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: 'white', padding: 20 } } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'white' } },
                x: { grid: { display: false }, ticks: { color: 'white' } }
            }
        }
    });

    // 4. Gráfica de Barras (Promedio por Componente)
    const ctxBar = document.getElementById('graficaPromedio').getContext('2d');
    if(chartBar) chartBar.destroy();

    const promedios = metricas.map(m => {
        let sum = 0;
        datos.forEach(d => sum += parseFloat(d[m] || 0));
        return (sum / datos.length).toFixed(4);
    });

    chartBar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: metricas,
            datasets: [{
                label: 'Valor Promedio',
                data: promedios,
                backgroundColor: colores.slice(0, metricas.length),
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'white' } },
                x: { ticks: { color: 'white' } }
            }
        }
    });
}