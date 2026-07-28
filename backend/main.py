import sqlite3
from fastapi import FastAPI, HTTPException, Header, status
from pydantic import BaseModel

app = FastAPI(
    title="Serviço Backend - Sistema de Votação Eletrônica",
    description="API interna responsável pelo processamento atômico de votos e persistência de dados.",
    version="1.1.0"
)

DB_FILE = "votacao.db"


def get_db_connection():
    """
    Retorna uma conexão configurada com timeout estendido e suporte 
    a concorrência multithread no SQLite.
    """
    conn = sqlite3.connect(DB_FILE, timeout=10.0, check_same_thread=False)
    # Habilita o modo Write-Ahead Logging (WAL) para permitir leituras 
    # e escritas simultâneas sem travar o banco.
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidatos (
            id INTEGER PRIMARY KEY,
            nome TEXT NOT NULL,
            partido TEXT NOT NULL,
            votos INTEGER DEFAULT 0
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM candidatos")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO candidatos (id, nome, partido, votos) VALUES (1, 'Candidato A', 'Partido Sol', 0)")
        cursor.execute("INSERT INTO candidatos (id, nome, partido, votos) VALUES (2, 'Candidato B', 'Partido Lua', 0)")
        conn.commit()
    conn.close()


init_db()


# DTO (Data Transfer Object) com Pydantic - Unmarshalling
class VotoRequest(BaseModel):
    candidato_id: int


@app.get("/health", tags=["Monitoramento"])
def health_check():
    """Heartbeat/Health Check para verificação do serviço em redes distribuídas."""
    return {"status": "Backend de Votação Operacional e Conectado ao BD!"}


@app.get("/candidatos", tags=["Votação"])
def listar_candidatos(
    x_request_id: str | None = Header(None, alias="x-request-id")
):
    """Retorna os candidatos e total parcial de votos."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, partido, votos FROM candidatos")
    linhas = cursor.fetchall()
    conn.close()
    
    candidatos = [
        {"id": row[0], "nome": row[1], "partido": row[2], "votos": row[3]}
        for row in linhas
    ]
    return {
        "request_id": x_request_id,
        "candidatos": candidatos
    }


@app.post("/votar", tags=["Votação"])
def registrar_voto(
    dados: VotoRequest,
    x_request_id: str | None = Header(None, alias="x-request-id"),
    x_user_id: str | None = Header(None, alias="x-user-id")
):
    """
    Computa e incrementa o voto de forma ATÔMICA.
    Evita Condições de Corrida (Race Conditions) em acessos concorrentes.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Incremento ATÔMICO no motor do banco de dados (Resolve Race Condition/Seção Crítica)
    cursor.execute(
        "UPDATE candidatos SET votos = votos + 1 WHERE id = ?", 
        (dados.candidato_id,)
    )
    
    # Se nenhuma linha foi afetada, o candidato não existe
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Erro de Validação: Candidato não localizado na base de dados."
        )
    
    conn.commit()

    # 2. Busca o total atualizado após a alteração atômica
    cursor.execute("SELECT votos FROM candidatos WHERE id = ?", (dados.candidato_id,))
    total_votos = cursor.fetchone()[0]
    conn.close()
    
    return {
        "mensagem": "Voto computado com sucesso!",
        "request_id": x_request_id,
        "eleitor_id": x_user_id,
        "candidato_id": dados.candidato_id,
        "total_votos_candidato": total_votos
    }