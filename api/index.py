from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Nombres exactos como los tienes en tu carpeta
ARCHIVOS = {
    "tarifas": "tarifas.xlsx",
    "reservas": "reservas.xlsx",
    "mda": "mda-mtr.xlsx", 
    "mtr": "mda-mtr.xlsx"
}

def cargar_excel(modulo: str):
    if modulo not in ARCHIVOS: return None
    ruta = os.path.join(BASE_DIR, "datos", ARCHIVOS[modulo])
    if not os.path.exists(ruta): return None
    try:
        sheet = "MDA" if modulo == "mda" else ("MTR" if modulo == "mtr" else 0)
        df = pd.read_excel(ruta, sheet_name=sheet)
        df.columns = df.columns.str.strip()
        
        col_fecha = next((c for c in df.columns if str(c).upper() in ['FECHA', 'FECHAOPERACION']), None)
        if col_fecha:
            df[col_fecha] = pd.to_datetime(df[col_fecha], dayfirst=True, errors='coerce')
            df['Año'] = df[col_fecha].dt.year.fillna(0).astype(int)
            df['Mes'] = df[col_fecha].dt.month.fillna(0).astype(int)
            df['Día'] = df[col_fecha].dt.day.fillna(0).astype(int)
        
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
            valores = [v for v in df[c].dropna().unique() if str(v).strip() != '0']
            try:
                valores = sorted(valores, key=lambda x: float(x))
            except:
                valores = sorted(valores)
            filtros[c] = [str(int(v)) if isinstance(v, float) and v.is_integer() else str(v) for v in valores]
                
    return filtros

@app.get("/api/datos")
def get_datos(request: Request):
    p = dict(request.query_params)
    mod = p.pop("modulo", None)
    df = cargar_excel(mod)
    if df is None: return []
    
    for col, val in p.items():
        if col in df.columns and val and val != "Todos":
            # Filtro robusto que no falla con los tipos de datos
            df_col_str = df[col].astype(str).str.replace('.0', '', regex=False).str.strip().str.upper()
            val_str = str(val).replace('.0', '').strip().upper()
            df = df[df_col_str == val_str]
    
    col_fecha = next((c for c in df.columns if str(c).upper() in ['FECHA', 'FECHAOPERACION']), None)
    if col_fecha:
        df = df.sort_values(by=col_fecha)
        df[col_fecha] = df[col_fecha].astype(str) # Evita crasheos en Vercel
        
    return df.fillna(0).to_dict(orient="records")