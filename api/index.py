from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI()

# Configuración de CORS para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Diccionario de archivos (Asegúrate de que la carpeta 'datos' exista)
ARCHIVOS = {
    "tarifas": "tarifas.xlsx",
    "reservas": "reservas.xlsx",
    "mda": "mda-mtr.xlsx", 
    "mtr": "mda-mtr.xlsx"
}

def cargar_excel(modulo: str):
    if modulo not in ARCHIVOS:
        return None
    ruta = os.path.join(BASE_DIR, "datos", ARCHIVOS[modulo])
    if not os.path.exists(ruta):
        print(f"Archivo no encontrado en: {ruta}")
        return None
    try:
        # Carga según pestaña si es MDA o MTR
        if modulo == "mda":
            df = pd.read_excel(ruta, sheet_name="MDA")
        elif modulo == "mtr":
            df = pd.read_excel(ruta, sheet_name="MTR")
        else:
            df = pd.read_excel(ruta)
            
        df.columns = df.columns.str.strip()
        
        # --- PROCESAMIENTO DE TIEMPO ---
        columna_fecha = None
        for col in df.columns:
            if str(col).upper() in ['FECHA', 'FECHAOPERACION', 'FECHA_OPERACION']:
                columna_fecha = col
                break
                
        if columna_fecha:
            df[columna_fecha] = pd.to_datetime(df[columna_fecha], dayfirst=True, errors='coerce')
            df['Año'] = df[columna_fecha].dt.year.fillna(0).astype(int).astype(str)
            df['Mes'] = df[columna_fecha].dt.month.fillna(0).astype(int).astype(str)
            df['Día'] = df[columna_fecha].dt.day.fillna(0).astype(int).astype(str)
            df = df[df['Año'] != '0']
        
        # --- ESTANDARIZACIÓN DE COLUMNAS ---
        renombres = {}
        for col in df.columns:
            c_up = str(col).upper()
            if c_up in ['DIVISION', 'DIVISIÓN']: renombres[col] = 'Division'
            elif c_up == 'TARIFA': renombres[col] = 'Tarifa'
            elif c_up == 'CONCEPTO': renombres[col] = 'Concepto'
            elif c_up == 'ZONARESERVA': renombres[col] = 'ZonaReserva'
            elif c_up == 'ZONACARGA': renombres[col] = 'ZonaCarga'
            elif c_up in ['HORAOPERACION', 'HORA_OPERACION', 'HORA']: renombres[col] = 'HoraOperacion'
                
        df = df.rename(columns=renombres)
        return df
    except Exception as e:
        print(f"Error cargando {modulo}: {e}")
        return None

@app.get("/api/filtros")
def obtener_filtros(modulo: str):
    df = cargar_excel(modulo)
    if df is None:
        raise HTTPException(status_code=404, detail="Error al cargar archivo.")
    
    filtros = {}
    columnas_permitidas = ["Año", "Tarifa", "Division", "Concepto", "Zona", "Sistema", "ZonaReserva", "ZonaCarga", "Mes", "Día"]
    
    for col in df.columns:
        if col in columnas_permitidas:
            valores = df[col].dropna().astype(str).unique()
            # Eliminar decimales .0 de años o días
            valores_limpios = sorted([v.replace('.0', '') for v in valores if v != '0'], 
                                     key=lambda x: float(x) if x.replace('.','',1).isdigit() else x)
            filtros[col] = valores_limpios
            
    return filtros

@app.get("/api/datos")
def obtener_datos(request: Request):
    params = dict(request.query_params)
    modulo = params.pop("modulo", None)
    
    df = cargar_excel(modulo)
    if df is None: return []
    
    # Aplicar filtros dinámicos
    for col, valor in params.items():
        if col in df.columns and valor != "":
            df = df[df[col].astype(str).str.replace('.0', '', regex=False) == str(valor)]
            
    df = df.fillna(0)
    # Eliminar columnas de fecha cruda para optimizar JSON
    columnas_eliminar = [c for c in df.columns if 'FECHA' in c.upper()]
    df = df.drop(columns=columnas_eliminar)
        
    return df.to_dict(orient="records")