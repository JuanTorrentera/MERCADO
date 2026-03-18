let moduloActual = 'tarifas';

// Función para asegurar que Plotly esté cargado
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
        
        for (const [nombre, opciones] of Object.entries(filtros)) {
            const div = document.createElement('div');
            div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre}</label>
                <select id="f-${nombre}"><option value="">Todos</option>
                ${opciones.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
            container.appendChild(div);
        }
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
    } catch (e) { console.error("Error ejecutando análisis:", e); }
}

function actualizarDashboard(data) {
    verificarPlotly(); // Asegurar Plotly antes de graficar
    if(!data.length) return alert("No hay datos para esta selección");
    
    // Actualizar Estadísticas
    const valores = data.map(b => b.Total || b.Precio || 0);
    const suma = valores.reduce((a,b) => a + b, 0);
    const promedio = suma / valores.length;
    
    document.getElementById('stat-promedio').innerText = promedio.toFixed(2);
    document.getElementById('stat-maximo').innerText = Math.max(...valores).toFixed(2);
    document.getElementById('stat-minimo').innerText = Math.min(...valores).toFixed(2);
    document.getElementById('stat-registros').innerText = data.length;
    
    // Crear Gráfica
    const traces = {};
    data.forEach(d => {
        const label = d.Concepto || d.ZonaReserva || d.Sistema || 'General';
        const fechaVal = d.Fecha || d.FechaOperacion;
        if(!traces[label]) traces[label] = {x:[], y:[], name: label, type:'scatter', mode: 'lines+markers'};
        traces[label].x.push(fechaVal);
        traces[label].y.push(d.Total || d.Precio || 0);
    });

    Plotly.newPlot('grafica', Object.values(traces), {
        paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b',
        font: {color: '#fff'}, margin: {t:30, r:30, l:50, b:50},
        xaxis: { title: 'Evolución Temporal', gridcolor: '#334155' },
        yaxis: { title: 'Valor ($)', gridcolor: '#334155' }
    });
}

// Iniciar cargando filtros
window.onload = () => {
    verificarPlotly();
    cargarFiltros();
};