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
        
        const orden = ["Año", "Mes", "Día", "Tarifa", "Division", "ZonaReserva", "ZonaCarga", "Sistema", "Concepto"];
        
        orden.forEach(nombre => {
            if (filtros[nombre] && filtros[nombre].length > 0) {
                const div = document.createElement('div');
                div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre}</label>
                    <select id="f-${nombre}"><option value="">Todos</option>
                    ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
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
        alert("Hubo un error al procesar los datos.");
    }
}

function actualizarDashboard(data) {
    verificarPlotly();
    if(!data || data.length === 0) return alert("No hay datos para esta selección");
    
    // Las columnas que son texto o fechas y NO deben sumarse
    const colsIgnorar = ['Año', 'Mes', 'Día', 'Hora', 'HoraOperacion', 'Fecha', 'FechaOperacion', 'Tarifa', 'Division', 'Concepto', 'Zona', 'Sistema', 'ZonaReserva', 'ZonaCarga'];
    
    // Función inteligente para calcular el valor real de la fila
    const getVal = (d) => {
        // Si el archivo ya trae un Precio o Total definido (como en MDA/MTR), úsalo
        if (d['Total'] !== undefined && d['Total'] !== 0) return parseFloat(d['Total']);
        if (d['Precio'] !== undefined && d['Precio'] !== 0) return parseFloat(d['Precio']);
        if (d['PML'] !== undefined && d['PML'] !== 0) return parseFloat(d['PML']);
        
        // Si no (como en Tarifas CFE), suma todos los componentes
        let sumaFila = 0;
        for (let key in d) {
            if (!colsIgnorar.includes(key) && typeof d[key] === 'number') {
                sumaFila += d[key];
            }
        }
        return sumaFila;
    };

    const valores = data.map(getVal);
    
    document.getElementById('stat-promedio').innerText = (valores.reduce((a,b) => a+b, 0) / valores.length).toFixed(2);
    document.getElementById('stat-maximo').innerText = Math.max(...valores).toFixed(2);
    document.getElementById('stat-minimo').innerText = Math.min(...valores).toFixed(2);
    document.getElementById('stat-registros').innerText = data.length;
    
    const traces = {};
    data.forEach(d => {
        const label = d.Concepto || d.ZonaReserva || d.Sistema || d.Tarifa || 'General';
        const fechaVal = d.Fecha || d.FechaOperacion || 'Punto';
        
        if(!traces[label]) traces[label] = {x:[], y:[], name: label, type: data.length < 10 ? 'bar' : 'scatter', mode: 'lines+markers'};
        traces[label].x.push(fechaVal);
        traces[label].y.push(getVal(d));
    });

    Plotly.newPlot('grafica', Object.values(traces), {
        paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b',
        font: {color: '#fff'}, margin: {t:30, r:30, l:50, b:80},
        xaxis: { gridcolor: '#334155', tickangle: -45 },
        yaxis: { title: 'Valor ($)', gridcolor: '#334155' }
    });
}

window.onload = () => {
    verificarPlotly();
    cargarFiltros();
};