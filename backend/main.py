import sqlite3
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

# A documentação Swagger/OpenAPI é gerada automaticamente pelo FastAPI em /docs
app = FastAPI(
    title="Serviço Backend - Sistema de Votação Eletrônica",
    description="API interna responsável pelo processamento de votos e contagem no banco de dados.",
    version="1.0.0"
)

DB_FILE = "votacao.db"

# --- PERSISTÊNCIA DE DADOS (SQLite) ---
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Tabela de Candidatos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidatos (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL,
            partido TEXT NOT NULL,
            votos INTEGER DEFAULT 0
        )
    """)
    
    # Popula com candidatos iniciais se o banco estiver vazio
    cursor.execute("SELECT COUNT(*) FROM candidatos")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO candidatos (id, nome, partido, votos) VALUES (1, 'Candidato A', 'Partido Sol', 0)")
        cursor.execute("INSERT INTO candidatos (id, nome, partido, votos) VALUES (2, 'Candidato B', 'Partido Lua', 0)")
        conn.commit()
    conn.close()

# Inicializa o banco ao subir a aplicação
init_db()

# --- MODELO DE ENTRADA (SERIALIZAÇÃO) ---
class VotoRequest(BaseModel):
    candidato_id: int

# --- ROTAS DO BACKEND ---

@app.get("/health", tags=["Monitoramento"])
def health_check():
    """Rota para verificar se o Backend e o Banco estão vivos."""
    return {"status": "Backend de Votação Operacional e Conectado ao SQLite!"}

@app.get("/candidatos", tags=["Votação"])
def listar_candidatos():
    """Retorna os candidatos e o total parcial de votos persistidos no banco."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, partido, votos FROM candidatos")
    linhas = cursor.fetchall()
    conn.close()
    
    candidatos = [
        {"id": row[0], "nome": row[1], "partido": row[2], "votos": row[3]}
        for row in linhas
    ]
    return {"candidatos": candidatos}

@app.post("/votar", tags=["Votação"])
def registrar_voto(dados: VotoRequest):
    """Computa e incrementa o voto de um eleitor no Banco de Dados."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("SELECT votos FROM candidatos WHERE id = ?", (dados.candidato_id,))
    resultado = cursor.fetchone()
    
    # Tratamento de exceção se o candidato não existir
    if not resultado:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Erro de Validação: Candidato não localizado na base de dados."
        )
        
    novos_votos = resultado[0] + 1
    cursor.execute("UPDATE candidatos SET votos = ? WHERE id = ?", (novos_votos, dados.candidato_id))
    conn.commit()
    conn.close()
    
    return {
        "mensagem": "Voto computado com sucesso!",
        "candidato_id": dados.candidato_id,
        "total_votos_candidato": novos_votos
    }