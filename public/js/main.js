let moduloActual = 'tarifas';

async function cambiarModulo(mod) {
    moduloActual = mod;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('modulo-titulo').innerText = event.target.innerText;
    await cargarFiltros();
}

async function cargarFiltros() {
    const res = await fetch(`/api/filtros?modulo=${moduloActual}`);
    const filtros = await res.json();
    const container = document.getElementById('filtros-container');
    container.innerHTML = '';
    
    // Lista de orden deseado para los filtros
    const orden = ["Año", "Mes", "Día", "Tarifa", "Division", "ZonaReserva", "ZonaCarga", "Sistema", "Concepto"];
    
    orden.forEach(nombre => {
        if (filtros[nombre]) {
            const div = document.createElement('div');
            div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre}</label>
                <select id="f-${nombre}"><option value="">Todos</option>
                ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
            container.appendChild(div);
        }
    });
}

async function ejecutar() {
    let url = `/api/datos?modulo=${moduloActual}`;
    document.querySelectorAll('#filtros-container select').forEach(s => {
        if(s.value) url += `&${s.id.replace('f-','')}=${s.value}`;
    });

    const res = await fetch(url);
    const datos = await res.json();
    actualizarDashboard(datos);
}

function actualizarDashboard(data) {
    if(!data.length) return alert("No hay datos para esta selección");
    
    // Identificar columnas de valor
    const getVal = (d) => d.Total || d.Precio || d.Energía || d.Potencia || d.Usuarios || 0;
    
    const valores = data.map(getVal);
    document.getElementById('stat-promedio').innerText = (valores.reduce((a,b) => a+b, 0) / valores.length).toFixed(2);
    document.getElementById('stat-maximo').innerText = Math.max(...valores).toFixed(2);
    document.getElementById('stat-minimo').innerText = Math.min(...valores).toFixed(2);
    document.getElementById('stat-registros').innerText = data.length;
    
    const traces = {};
    data.forEach(d => {
        const label = d.Concepto || d.ZonaReserva || d.Tarifa || 'General';
        const fecha = d.Fecha || d.FechaOperacion || d.HoraOperacion || 'Punto';
        
        if(!traces[label]) {
            traces[label] = {
                x:[], y:[], name: label, 
                type: data.length < 50 ? 'bar' : 'scatter', 
                mode: 'lines+markers'
            };
        }
        traces[label].x.push(fecha);
        traces[label].y.push(getVal(d));
    });

    Plotly.newPlot('grafica', Object.values(traces), {
        paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b',
        font: {color: '#fff'}, margin: {t:30, r:30, l:50, b:80},
        xaxis: { gridcolor: '#334155', tickangle: -45 },
        yaxis: { gridcolor: '#334155' }
    });
}

window.onload = cargarFiltros;