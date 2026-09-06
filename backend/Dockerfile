FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir ".[dev]"

# Copy application code
COPY . .

# Generate dev JWT keys
RUN python -c "from app.core.security import generate_rsa_key_pair; k=generate_rsa_key_pair(); open('/tmp/private_key.pem','w').write(k[0]); open('/tmp/public_key.pem','w').write(k[1])"

EXPOSE 8000

# Apply pending migrations before serving so the schema is always current
CMD ["sh", "-c", "PYTHONPATH=/app alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]
