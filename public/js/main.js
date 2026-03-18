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
    
    for (const [nombre, opciones] of Object.entries(filtros)) {
        const div = document.createElement('div');
        div.innerHTML = `<label>${nombre}</label>
            <select id="f-${nombre}"><option value="">Todos</option>
            ${opciones.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
        container.appendChild(div);
    }
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
    if(!data.length) return alert("No hay datos");
    document.getElementById('stat-promedio').innerText = (data.reduce((a,b) => a + (b.Total || b.Precio || 0), 0) / data.length).toFixed(2);
    document.getElementById('stat-registros').innerText = data.length;
    
    const traces = {};
    data.forEach(d => {
        const label = d.Concepto || d.ZonaReserva || 'General';
        if(!traces[label]) traces[label] = {x:[], y:[], name: label, type:'scatter'};
        traces[label].x.push(d.Fecha || d.FechaOperacion);
        traces[label].y.push(d.Total || d.Precio || 0);
    });

    Plotly.newPlot('grafica', Object.values(traces), {
        paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b',
        font: {color: '#fff'}, margin: {t:30, r:30, l:50, b:50}
    });
}

window.onload = cargarFiltros;