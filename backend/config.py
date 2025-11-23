"""
Configuration settings for the Attendance Management System
"""
import os

class Config:
    # Database configuration
    # PostgreSQL/Supabase connection string (required for production)
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    # Handle Supabase connection string format and add necessary parameters
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    # Add connection parameters for Windows compatibility and reliability
    if DATABASE_URL and 'postgresql' in DATABASE_URL:
        # Add gssencmode=disable if not present (prevents IPv6 issues on Windows)
        if 'gssencmode' not in DATABASE_URL:
            separator = '&' if '?' in DATABASE_URL else '?'
            DATABASE_URL = f"{DATABASE_URL}{separator}gssencmode=disable"
        
        # Add sslmode=require if not present (recommended for Supabase)
        if 'sslmode' not in DATABASE_URL:
            separator = '&' if '?' in DATABASE_URL else '?'
            DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=require"
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///attendance.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Optimized connection pool settings for PostgreSQL/Supabase
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,               # Reduced for stability (was 10)
        'pool_recycle': 280,          # Recycle connections before Supabase's 300s timeout
        'pool_pre_ping': True,        # Verify connections before using
        'pool_timeout': 20,           # Reduced timeout for faster failure detection
        'max_overflow': 3,            # Reduced overflow (was 5)
        'echo_pool': False,           # Disable pool logging for performance
        'connect_args': {
            'connect_timeout': 10,    # Connection timeout in seconds
            'options': '-c timezone=utc -c statement_timeout=30000',  # Added query timeout
            'keepalives': 1,          # Enable TCP keepalive
            'keepalives_idle': 30,    # Start keepalive after 30s
            'keepalives_interval': 10, # Keepalive interval
            'keepalives_count': 5     # Number of keepalive probes
        } if DATABASE_URL and 'postgresql' in (DATABASE_URL or '') else {}
    }
    
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
        if app.config['SQLALCHEMY_DATABASE_URI']:
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            if 'postgresql' in db_uri:
                # Mask password in logs
                safe_uri = db_uri.split('@')[1] if '@' in db_uri else 'localhost'
                print(f"✓ Using PostgreSQL database at: {safe_uri}")
            else:
                print("✓ Using SQLite database (local development)")
