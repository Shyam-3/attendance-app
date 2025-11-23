"""
Test Supabase PostgreSQL connection
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')

print(f"Testing connection to: {DATABASE_URL[:50]}...")

try:
    # Parse the URL to add gssencmode parameter
    if DATABASE_URL:
        # Add parameter to disable IPv6 preference
        if '?' in DATABASE_URL:
            conn_str = f"{DATABASE_URL}&gssencmode=disable"
        else:
            conn_str = f"{DATABASE_URL}?gssencmode=disable"
        
        print("Attempting connection...")
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Test query
        cur.execute('SELECT version();')
        version = cur.fetchone()[0]
        
        print(f"✓ Connection successful!")
        print(f"✓ PostgreSQL version: {version[:80]}...")
        
        # Check tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        tables = cur.fetchall()
        
        if tables:
            print(f"✓ Found {len(tables)} tables:")
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print("ℹ No tables found yet (will be created on first run)")
        
        cur.close()
        conn.close()
        print("\n✅ Database connection test PASSED!")
        
except Exception as e:
    print(f"\n✗ Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Check your DATABASE_URL in .env file")
    print("2. Verify your Supabase project is active")
    print("3. Ensure password is URL-encoded")
    print("4. Try using port 6543 (connection pooler)")
