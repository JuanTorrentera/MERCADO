let moduloActual = 'tarifas';

function verificarPlotly() {
    if (typeof Plotly === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
        document.head.appendChild(script);
    }
}

async function cambiarModulo(mod) {
    moduloActual = mod;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('modulo-titulo').innerText = event.target.innerText;
    await cargarFiltros();
}

async function cargarFiltros() {
    try {
        const res = await fetch(`/api/filtros?modulo=${moduloActual}`);
        const filtros = await res.json();
        const container = document.getElementById('filtros-container');
        container.innerHTML = '';
        
        const orden = ["Año", "Mes", "Día", "Tarifa", "Division", "ZonaReserva", "ZonaCarga", "Zona", "Sistema", "Concepto"];
        
        orden.forEach(nombre => {
            if (filtros[nombre] && filtros[nombre].length > 0) {
                const div = document.createElement('div');
                
                // CONDICIÓN: En Tarifas CFE, "Tarifa" y "Division" no tienen la opción "Todos"
                if (moduloActual === 'tarifas' && (nombre === 'Tarifa' || nombre === 'Division')) {
                    div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre} (Obligatorio)</label>
                        <select id="f-${nombre}">
                        ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
                } else {
                    div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre}</label>
                        <select id="f-${nombre}"><option value="">Todos</option>
                        ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
                }
                container.appendChild(div);
            }
        });
    } catch (e) { console.error("Error cargando filtros:", e); }
}

async function ejecutar() {
    try {
        let url = `/api/datos?modulo=${moduloActual}`;
        document.querySelectorAll('#filtros-container select').forEach(s => {
            if(s.value) url += `&${s.id.replace('f-','')}=${s.value}`;
        });

        const res = await fetch(url);
        const datos = await res.json();
        actualizarDashboard(datos);
    } catch (e) { 
        console.error("Error ejecutando análisis:", e); 
    }
}

function actualizarDashboard(data) {
    verificarPlotly();
    if(!data || data.length === 0) return alert("No hay datos para esta selección");

    // 1. ORDENAR LOS DATOS POR TIEMPO (Soluciona el gráfico enredado)
    data.sort((a, b) => {
        let fA = (a.Fecha || a.FechaOperacion || '').split(' ')[0];
        let fB = (b.Fecha || b.FechaOperacion || '').split(' ')[0];
        let hA = String(a.Hora || a.HoraOperacion || '0').padStart(2, '0');
        let hB = String(b.Hora || b.HoraOperacion || '0').padStart(2, '0');
        return (fA + 'T' + hA).localeCompare(fB + 'T' + hB);
    });

    // 2. DETECTAR COLUMNAS DE VALORES (Componentes reales)
    const colsIgnorar = ['AÑO', 'MES', 'DÍA', 'HORA', 'HORAOPERACION', 'FECHA', 'FECHAOPERACION', 'TARIFA', 'DIVISION', 'CONCEPTO', 'ZONA', 'SISTEMA', 'ZONARESERVA', 'ZONACARGA', 'ESTADO', 'TOTAL', 'PRECIO', 'PML'];
    let colsComponentes = Object.keys(data[0]).filter(k => !colsIgnorar.includes(k.toUpperCase()) && typeof data[0][k] === 'number');

    // Función para sacar el Total de la fila
    const getValTotal = (d) => {
        if (d['Total'] !== undefined) return d['Total'];
        if (d['Precio'] !== undefined) return d['Precio'];
        if (d['PML'] !== undefined) return d['PML'];
        let suma = 0;
        colsComponentes.forEach(col => suma += (d[col] || 0));
        return suma;
    };

    const totales = data.map(getValTotal);
    const prom = totales.reduce((a,b)=>a+b,0) / totales.length;
    const max = Math.max(...totales);
    const min = Math.min(...totales);

    // Actualizar Tarjetas
    document.getElementById('stat-promedio').innerText = prom.toFixed(2);
    document.getElementById('stat-maximo').innerText = max.toFixed(2);
    document.getElementById('stat-minimo').innerText = min.toFixed(2);
    document.getElementById('stat-registros').innerText = data.length;

    // Eje X (Tiempo bien formateado)
    let xValues = data.map(d => {
        let f = (d.Fecha || d.FechaOperacion || '').split(' ')[0];
        let h = d.Hora || d.HoraOperacion;
        return h !== undefined ? `${f} ${String(h).padStart(2, '0')}:00` : f;
    });

    // --- GRÁFICA 1: TENDENCIA Y LÍNEAS DE MIN/MAX/PROM ---
    let traceValorReal = { x: xValues, y: totales, name: 'Valor', type: 'scatter', mode: 'lines', line: {color: '#00d4ff', width: 2} };
    let traceMax = { x: [xValues[0], xValues[xValues.length-1]], y: [max, max], name: 'Máximo', type: 'scatter', mode: 'lines', line: {color: '#ef4444', dash: 'dash', width: 2} };
    let traceMin = { x: [xValues[0], xValues[xValues.length-1]], y: [min, min], name: 'Mínimo', type: 'scatter', mode: 'lines', line: {color: '#22c55e', dash: 'dash', width: 2} };
    let traceAvg = { x: [xValues[0], xValues[xValues.length-1]], y: [prom, prom], name: 'Promedio', type: 'scatter', mode: 'lines', line: {color: '#eab308', dash: 'dash', width: 2} };

    Plotly.newPlot('grafica-total', [traceValorReal, traceMax, traceAvg, traceMin], {
        title: {text: 'Comportamiento General en el Tiempo', font: {color: '#fff'}},
        paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b', font: {color: '#fff'},
        margin: {t:40, r:30, l:50, b:80},
        xaxis: { gridcolor: '#334155', tickangle: -45 },
        yaxis: { title: 'Valor ($)', gridcolor: '#334155' }
    });

    // --- GRÁFICA 2: COMPONENTES POR HORARIO ---
    if (colsComponentes.length > 1) {
        document.getElementById('grafica-componentes').style.display = 'block';
        let tracesComp = colsComponentes.map(col => ({
            x: xValues,
            y: data.map(d => d[col] || 0),
            name: col,
            type: data.length < 10 ? 'bar' : 'scatter', mode: 'lines+markers'
        }));

        Plotly.newPlot('grafica-componentes', tracesComp, {
            title: {text: 'Desglose Horario por Componentes', font: {color: '#fff'}},
            paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b', font: {color: '#fff'},
            margin: {t:40, r:30, l:50, b:80},
            xaxis: { gridcolor: '#334155', tickangle: -45 },
            yaxis: { title: 'Valor ($)', gridcolor: '#334155' }
        });
    } else {
        // Si no hay componentes separados (ej. solo un PML), ocultamos la gráfica de abajo
        document.getElementById('grafica-componentes').style.display = 'none';
    }
}

window.onload = () => {
    verificarPlotly();
    cargarFiltros();
};