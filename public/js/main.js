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
    
    ['grafica-total', 'grafica-componentes', 'grafica-energia', 'grafica-potencia', 'grafica-usuarios', 'grafica-estadistica'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    
    await cargarFiltros();
}

async function cargarFiltros() {
    try {
        const res = await fetch(`/api/filtros?modulo=${moduloActual}`);
        const filtros = await res.json();
        const container = document.getElementById('filtros-container');
        container.innerHTML = '';
        
        let orden = [];
        if (moduloActual === 'tarifas') {
            orden = ["Año", "Tarifa", "Division"];
        } else if (moduloActual === 'reservas') {
            orden = ["Año", "Mes", "ZonaReserva"];
        } else {
            orden = ["Año", "Mes", "ZonaCarga", "Zona", "Sistema"];
        }
        
        orden.forEach(nombre => {
            if (filtros[nombre] && filtros[nombre].length > 0) {
                const div = document.createElement('div');
                
                // MAGIA AQUÍ: Le quitamos "Año" a las condiciones obligatorias de Tarifas
                let esObligatorio = false;
                if (moduloActual === 'tarifas' && (nombre === 'Tarifa' || nombre === 'Division')) esObligatorio = true;
                if (moduloActual !== 'tarifas' && (nombre === 'Año' || nombre === 'Mes' || nombre === 'ZonaCarga' || nombre === 'ZonaReserva')) esObligatorio = true;

                if (esObligatorio) {
                    div.innerHTML = `<label style="color: #00d4ff; font-weight:bold; font-size: 0.8rem;">${nombre} *</label>
                        <select id="f-${nombre}" required>
                        <option value="">-- Selecciona --</option>
                        ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
                } else {
                    div.innerHTML = `<label style="color: #94a3b8; font-size: 0.8rem;">${nombre}</label>
                        <select id="f-${nombre}">
                        <option value="">Todos</option>
                        ${filtros[nombre].map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
                }
                container.appendChild(div);
            }
        });
    } catch (e) { console.error("Error cargando filtros:", e); }
}

async function ejecutar() {
    let faltan = false;
    document.querySelectorAll('#filtros-container select[required]').forEach(s => {
        if(!s.value) faltan = true;
    });
    if(faltan) {
        alert("¡Hola! Por favor selecciona las opciones marcadas en color azul (*)");
        return;
    }

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
    if(!data || data.length === 0) return alert("No se encontraron registros para esta combinación.");

    ['grafica-total', 'grafica-componentes', 'grafica-energia', 'grafica-potencia', 'grafica-usuarios', 'grafica-estadistica'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });

    data.sort((a, b) => {
        let fA = (a.Fecha || a.FechaOperacion || '').split(' ')[0];
        let fB = (b.Fecha || b.FechaOperacion || '').split(' ')[0];
        let hA = String(a.Hora || a.HoraOperacion || '0').padStart(2, '0');
        let hB = String(b.Hora || b.HoraOperacion || '0').padStart(2, '0');
        return (fA + 'T' + hA).localeCompare(fB + 'T' + hB);
    });

    const colsIgnorar = ['AÑO', 'MES', 'DÍA', 'HORA', 'HORAOPERACION', 'FECHA', 'FECHAOPERACION', 'TARIFA', 'DIVISION', 'CONCEPTO', 'ZONA', 'SISTEMA', 'ZONARESERVA', 'ZONACARGA', 'ESTADO', 'TOTAL', 'PRECIO', 'PML', 'PRECIOZONAL_MWH'];
    let colsComponentes = Object.keys(data[0]).filter(k => !colsIgnorar.includes(k.toUpperCase()) && typeof data[0][k] === 'number');

    const getValTotal = (d) => {
        if (d['Total'] !== undefined) return d['Total'];
        if (d['Precio'] !== undefined) return d['Precio'];
        if (d['PML'] !== undefined) return d['PML'];
        if (d['PrecioZonal_MWh'] !== undefined) return d['PrecioZonal_MWh'];
        
        let suma = 0;
        colsComponentes.forEach(col => suma += (d[col] || 0));
        return suma;
    };

    const layoutBase = { paper_bgcolor: '#1e293b', plot_bgcolor: '#1e293b', font: {color: '#fff'}, margin: {t:40, r:30, l:50, b:80}, xaxis: { gridcolor: '#334155', tickangle: -45 }, yaxis: { title: 'Valor ($)', gridcolor: '#334155' }};

    if (moduloActual === 'tarifas') {
        const totales = data.map(getValTotal);
        document.getElementById('stat-promedio').innerText = (totales.reduce((a,b)=>a+b,0)/totales.length).toFixed(2);
        document.getElementById('stat-maximo').innerText = Math.max(...totales).toFixed(2);
        document.getElementById('stat-minimo').innerText = Math.min(...totales).toFixed(2);
        document.getElementById('stat-registros').innerText = data.length;

        ['Energía', 'Potencia', 'Usuarios'].forEach(concepto => {
            let dataConcepto = data.filter(d => d.Concepto && d.Concepto.toUpperCase().replace('Í','I') === concepto.toUpperCase().replace('Í','I'));
            if (dataConcepto.length > 0) {
                let x = dataConcepto.map(d => (d.Fecha || d.FechaOperacion || '').split(' ')[0]);
                let y = dataConcepto.map(getValTotal);
                let divId = `grafica-${concepto.toLowerCase().replace('í','i')}`;
                
                let colorLinea = concepto === 'Energía' ? '#00d4ff' : (concepto === 'Potencia' ? '#f97316' : '#22c55e');
                
                document.getElementById(divId).style.display = 'block';
                Plotly.newPlot(divId, [{ x: x, y: y, name: concepto, type: 'scatter', mode: 'lines+markers', line: {width: 3, color: colorLinea} }], 
                {...layoutBase, title: {text: `Evolución Histórica: ${concepto}`, font: {color: colorLinea}}});
            }
        });

    } else {
        const totales = data.map(getValTotal);
        document.getElementById('stat-promedio').innerText = (totales.reduce((a,b)=>a+b,0) / totales.length).toFixed(2);
        document.getElementById('stat-maximo').innerText = Math.max(...totales).toFixed(2);
        document.getElementById('stat-minimo').innerText = Math.min(...totales).toFixed(2);
        document.getElementById('stat-registros').innerText = data.length;

        let xValues = data.map(d => {
            let f = (d.Fecha || d.FechaOperacion || '').split(' ')[0];
            let h = d.Hora || d.HoraOperacion;
            return h !== undefined ? `${f} ${String(h).padStart(2, '0')}:00` : f;
        });

        document.getElementById('grafica-componentes').style.display = 'block';
        document.getElementById('grafica-estadistica').style.display = 'block';

        let tracesComp = colsComponentes.map(col => ({ x: xValues, y: data.map(d => d[col] || 0), name: col, type: 'scatter', mode: 'lines', line: {width: 2} }));
        Plotly.newPlot('grafica-componentes', tracesComp, {...layoutBase, title: {text: 'Desglose Horario de Componentes', font: {color: '#fff'}}});

        let horas = data.map(d => String(d.Hora || d.HoraOperacion || '0').padStart(2, '0') + ':00');
        Plotly.newPlot('grafica-estadistica', [{ x: horas, y: totales, type: 'box', name: 'Distribución', marker: {color: '#eab308'} }], 
        {...layoutBase, title: {text: 'Perfil Estadístico de Volatilidad Horaria (Análisis de Mercado)', font: {color: '#eab308'}}, xaxis: {title: 'Hora del Día', dtick: 1}});
    }
}

window.onload = () => {
    verificarPlotly();
    cargarFiltros();
};