"""
Configuration settings for the Attendance Management System
"""
import os
import socket
import socket

class Config:
    # Database configuration - PostgreSQL/Supabase only
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is required. Please configure your PostgreSQL/Supabase connection string in .env file.")
    
    # Handle Supabase connection string format
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    # Add connection parameters for Windows compatibility and reliability
    if 'gssencmode' not in DATABASE_URL:
        separator = '&' if '?' in DATABASE_URL else '?'
        DATABASE_URL = f"{DATABASE_URL}{separator}gssencmode=disable"
    
    if 'sslmode' not in DATABASE_URL:
        separator = '&' if '?' in DATABASE_URL else '?'
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"

    # Attempt to force IPv4 by adding hostaddr to the DSN to avoid IPv6-only resolution in some environments
    try:
        if '@' in DATABASE_URL:
            host_port = DATABASE_URL.split('@')[1].split('/')[0]
            host = host_port.split(':')[0]
            addrs = socket.getaddrinfo(host, None, family=socket.AF_INET)
            if addrs:
                ipv4 = addrs[0][4][0]
                separator = '&' if '?' in DATABASE_URL else '?'
                DATABASE_URL = f"{DATABASE_URL}{separator}hostaddr={ipv4}"
    except Exception:
        # If resolution fails, proceed without hostaddr
        pass
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # PostgreSQL/Supabase connection pool settings
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,
        'pool_recycle': 280,
        'pool_pre_ping': True,
        'pool_timeout': 20,
        'max_overflow': 3,
        'echo_pool': False,
        'connect_args': {
            'connect_timeout': 10,
            'options': '-c timezone=utc -c statement_timeout=30000',
            'keepalives': 1,
            'keepalives_idle': 30,
            'keepalives_interval': 10,
            'keepalives_count': 5
        }
    }

    # Resolve DB host to IPv4 and set hostaddr to avoid IPv6 unreachable issues on some hosts (e.g., Railway)
    try:
        if '@' in DATABASE_URL:
            host_port = DATABASE_URL.split('@')[1].split('/')[0]
            host = host_port.split(':')[0]
            addrs = socket.getaddrinfo(host, None, family=socket.AF_INET)
            if addrs:
                ipv4 = addrs[0][4][0]
                SQLALCHEMY_ENGINE_OPTIONS['connect_args']['hostaddr'] = ipv4
    except Exception:
        pass
    
    # File upload configuration
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    
    # Frontend configuration (React dev server or deployed URL)
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://127.0.0.1:5173')
    
    @staticmethod
    def init_app(app):
        # Log database connection info (without password)
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        safe_uri = db_uri.split('@')[1] if '@' in db_uri else 'localhost'
        print(f"✓ Using PostgreSQL/Supabase database at: {safe_uri}")
