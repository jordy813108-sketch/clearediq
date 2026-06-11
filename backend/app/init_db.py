from app.core.database import Base, engine
from app.models import models  # noqa: F401 - ensures models are registered

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully")

if __name__ == "__main__":
    init_db()
