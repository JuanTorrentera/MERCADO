import uvicorn
from api.index import app
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Servir archivos estáticos
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def main():
    return FileResponse("index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)