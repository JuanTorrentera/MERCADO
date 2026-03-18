from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

ARCHIVOS = {
    "tarifas": "tarifas.xlsx",
    "reservas": "reservas.xlsx",
    "mda": "MDA-MTR.xlsx", 
    "mtr": "MDA-MTR.xlsx"
}

def cargar_excel(modulo: str):
    if modulo not in ARCHIVOS: return None
    ruta = os.path.join(BASE_DIR, "datos", ARCHIVOS[modulo])
    if not os.path.exists(ruta): return None
    try:
        sheet = "MDA" if modulo == "mda" else ("MTR" if modulo == "mtr" else 0)
        df = pd.read_excel(ruta, sheet_name=sheet)
        df.columns = df.columns.str.strip()
        
        # Procesar Fechas
        col_fecha = next((c for c in df.columns if str(c).upper() in ['FECHA', 'FECHAOPERACION']), None)
        if col_fecha:
            df[col_fecha] = pd.to_datetime(df[col_fecha], dayfirst=True, errors='coerce')
            df['Año'] = df[col_fecha].dt.year.fillna(0).astype(int)
            df['Mes'] = df[col_fecha].dt.month.fillna(0).astype(int)
            df['Día'] = df[col_fecha].dt.day.fillna(0).astype(int)
            df = df[df['Año'] != 0]
        
        # Forzar que los valores sean numéricos
        cols_valor = ['Total', 'Precio', 'Energía', 'Potencia', 'Usuarios']
        for cv in cols_valor:
            if cv in df.columns:
                df[cv] = pd.to_numeric(df[cv], errors='coerce').fillna(0)

        renames = {'DIVISION': 'Division', 'TARIFA': 'Tarifa', 'CONCEPTO': 'Concepto', 
                   'ZONARESERVA': 'ZonaReserva', 'ZONACARGA': 'ZonaCarga', 'HORA': 'HoraOperacion'}
        df = df.rename(columns={k: v for k, v in renames.items() if k in df.columns})
        return df
    except: return None

@app.get("/api/filtros")
def get_filtros(modulo: str):
    df = cargar_excel(modulo)
    if df is None: raise HTTPException(status_code=404)
    cols_interes = ["Año", "Tarifa", "Division", "Concepto", "Zona", "Sistema", "ZonaReserva", "ZonaCarga", "Mes", "Día"]
    
    filtros = {}
    for c in df.columns:
        if c in cols_interes:
            # Ordenar numéricamente para Día, Mes, Año
            valores = sorted(df[c].dropna().unique())
            filtros[c] = [str(int(v)) if isinstance(v, float) else str(v) for v in valores]
                
    return filtros

@app.get("/api/datos")
def get_datos(request: Request):
    p = dict(request.query_params)
    mod = p.pop("modulo", None)
    df = cargar_excel(mod)
    if df is None: return []
    for col, val in p.items():
        if col in df.columns and val:
            # Comparación robusta
            df = df[df[col].astype(str).str.replace('.0', '', regex=False) == str(val)]
    
    # Ordenar por fecha para que la gráfica no se cruce
    col_fecha = next((c for c in df.columns if str(c).upper() in ['FECHA', 'FECHAOPERACION']), None)
    if col_fecha:
        df = df.sort_values(by=col_fecha)
        
    return df.to_dict(orient="records")