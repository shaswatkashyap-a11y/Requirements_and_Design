from __future__ import annotations

import os
from sqlalchemy import create_engine,text
from sqlalchemy.orm import sessionmaker,declarative_base
from dotenv import load_dotenv

load_dotenv()
 
DATABASE_URL=os.getenv("DATABASE_URL")

if not DATABASE_URL:
    MYSQL_USER=os.getenv("MYSQL_USER")
    MYSQL_PASSWORD=os.getenv("MYSQL_PASSWORD")
    MYSQL_PORT=os.getenv("MYSQL_PORT","3306")
    MYSQL_HOST=os.getenv("MYSQL_HOST","127.0.0.1")
    MYSQL_DB=os.getenv("MYSQL_DB")

    missing=[
        name for name,val in {
            "MYSQL_USER":MYSQL_USER,
            "MYSQL_PASSWORD":MYSQL_PASSWORD,
            "MYSQL_PORT":MYSQL_PORT,
            "MYSQL_HOST":MYSQL_HOST,
            "MYSQL_DB":MYSQL_DB
            }.items() if not val
    ]

    if missing:
        raise RuntimeError(
            "missing required DB env vars: "
            +",".join(missing)
            +". Set DATABASE_URL or MYSQL_USER/MYSQL_PASSWORD/MYSQL_DB in your .env"
        )
    
    # mysql+pymysql://root:Jade2025@localhost:3306/rdstudio

    DATABASE_URL=(
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )


engine=create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,
    future=True
)

SessionLocal=sessionmaker(bind=engine,autocommit=False,autoflush=False,future=True)

Base=declarative_base()

def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()

def checkConnection():
    session = SessionLocal()
    try:
        session.execute(text("SELECT 1"))
        print(" CONNECTION ESTABLISHED")
    except Exception as e:
        print(f"FAILED TO ESTABLISH THE CONNECTION {e}")
    finally:
        session.close()
