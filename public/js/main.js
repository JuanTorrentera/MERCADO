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
        
        // Añadimos ZonaCarga y Sistema para que salgan en MDA y MTR
        const orden = ["Año", "Mes", "Día", "Tarifa", "Division", "ZonaReserva", "ZonaCarga", "Zona", "Sistema", "Concepto"];
        
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
    
    // Columnas que NO se deben sumar
    const colsIgnorar = ['AÑO', 'MES', 'DÍA', 'HORA', 'HORAOPERACION', 'FECHA', 'FECHAOPERACION', 'TARIFA', 'DIVISION', 'CONCEPTO', 'ZONA', 'SISTEMA', 'ZONARESERVA', 'ZONACARGA', 'ESTADO'];
    
    // Función inteligente a prueba de balas para sacar el dinero/precio
    const getVal = (d) => {
        const nombresPrecio = ['Total', 'Precio', 'PML', 'Precio Marginal Local'];
        
        // 1. Busca si existe una columna que se llame Precio o PML
        for (let nombre of nombresPrecio) {
            let colExacta = Object.keys(d).find(k => k.toUpperCase() === nombre.toUpperCase());
            if (colExacta && !isNaN(parseFloat(d[colExacta]))) {
                return parseFloat(d[colExacta]);
            }
        }
        
        // 2. Si no hay, suma los componentes (para Tarifas)
        let sumaFila = 0;
        for (let key in d) {
            if (!colsIgnorar.includes(key.toUpperCase()) && !isNaN(parseFloat(d[key]))) {
                sumaFila += parseFloat(d[key]);
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
        // Etiqueta para separar líneas (ej. Diferentes Nodos o Zonas de Carga en MDA)
        const label = d.ZonaCarga || d.ZonaReserva || d.Zona || d.Sistema || d.Concepto || d.Tarifa || 'General';
        
        // Reparación del tiempo: Unir Fecha y Hora para graficar los 24 puntos sin que se encimen
        let fechaPura = d.Fecha || d.FechaOperacion || 'Punto';
        fechaPura = String(fechaPura).split(' ')[0]; // Nos quedamos solo con YYYY-MM-DD
        
        let hora = d.Hora || d.HoraOperacion;
        let fechaVal = hora !== undefined ? `${fechaPura} ${String(hora).padStart(2, '0')}:00` : fechaPura;
        
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