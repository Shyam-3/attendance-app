import { Pool, QueryResult } from 'pg';

export const pool: Pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout
});

// Handle pool errors silently to avoid unhandled rejections
// (idle connection termination from Supabase is expected)
pool.on('error', () => {
  // Silently ignore idle connection errors
});

// Type definitions matching Prisma models
export interface Student {
  id: number;
  user_id: string;
  admission_no: string;
  registration_no: string;
  name: string;
  created_at: Date;
}

export interface Course {
  id: number;
  user_id: string;
  course_code: string;
  course_name: string;
  created_at: Date;
}

export interface AttendanceRecord {
  id: number;
  user_id: string;
  student_id: number;
  course_id: number;
  attended_periods: number;
  conducted_periods: number;
  attendance_percentage: number;
  upload_date: Date;
}

/**
 * Student queries
 */
export const studentQueries = {
  async findMany(where: { user_id: string; registration_no?: { in: string[] } }) {
    const { user_id, registration_no } = where;
    if (registration_no?.in) {
      const result = await pool.query(
        'SELECT * FROM students WHERE user_id = $1 AND registration_no = ANY($2)',
        [user_id, registration_no.in]
      );
      return result.rows as Student[];
    }
    const result = await pool.query('SELECT * FROM students WHERE user_id = $1', [user_id]);
    return result.rows as Student[];
  },

  async createMany(data: { data: Array<Omit<Student, 'id' | 'created_at'>>; skipDuplicates?: boolean }) {
    if (!data.data.length) return;
    const values = data.data
      .map((s, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`)
      .join(',');
    const params: any[] = [];
    data.data.forEach(s => {
      params.push(s.user_id, s.admission_no, s.registration_no, s.name);
    });
    const query = `
      INSERT INTO students (user_id, admission_no, registration_no, name)
      VALUES ${values}
      ON CONFLICT (user_id, registration_no) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, params);
    return result.rows as Student[];
  },

  async deleteMany(where: { user_id: string }) {
    const result = await pool.query('DELETE FROM students WHERE user_id = $1', [where.user_id]);
    return { count: result.rowCount };
  },
};

/**
 * Course queries
 */
export const courseQueries = {
  async findMany(where: { user_id: string; course_code?: { in: string[] } }) {
    const { user_id, course_code } = where;
    if (course_code?.in) {
      const result = await pool.query(
        'SELECT * FROM courses WHERE user_id = $1 AND course_code = ANY($2)',
        [user_id, course_code.in]
      );
      return result.rows as Course[];
    }
    const result = await pool.query('SELECT * FROM courses WHERE user_id = $1', [user_id]);
    return result.rows as Course[];
  },

  async createMany(data: { data: Array<Omit<Course, 'id' | 'created_at'>>; skipDuplicates?: boolean }) {
    if (!data.data.length) return;
    const values = data.data
      .map((c, i) => `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`)
      .join(',');
    const params: any[] = [];
    data.data.forEach(c => {
      params.push(c.user_id, c.course_code, c.course_name);
    });
    const query = `
      INSERT INTO courses (user_id, course_code, course_name)
      VALUES ${values}
      ON CONFLICT (user_id, course_code) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, params);
    return result.rows as Course[];
  },

  async deleteMany(where: { user_id: string }) {
    const result = await pool.query('DELETE FROM courses WHERE user_id = $1', [where.user_id]);
    return { count: result.rowCount };
  },
};

/**
 * AttendanceRecord queries
 */
export const attendanceRecordQueries = {
  async findMany(where: any = {}) {
    let query = 'SELECT * FROM attendance_records WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (where.user_id) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(where.user_id);
    }
    if (where.student_id) {
      query += ` AND student_id = $${paramIndex++}`;
      params.push(where.student_id);
    }
    if (where.course_id) {
      query += ` AND course_id = $${paramIndex++}`;
      params.push(where.course_id);
    }

    const result = await pool.query(query, params);
    return result.rows as AttendanceRecord[];
  },

  async createMany(data: { data: Array<Omit<AttendanceRecord, 'id' | 'upload_date'>> }) {
    if (!data.data.length) return;
    const values = data.data
      .map((a, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6})`)
      .join(',');
    const params: any[] = [];
    data.data.forEach(a => {
      params.push(a.user_id, a.student_id, a.course_id, a.attended_periods, a.conducted_periods, a.attendance_percentage);
    });
    const query = `
      INSERT INTO attendance_records (user_id, student_id, course_id, attended_periods, conducted_periods, attendance_percentage)
      VALUES ${values}
      ON CONFLICT (user_id, student_id, course_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, params);
    return result.rows as AttendanceRecord[];
  },

  async deleteMany(where: { user_id: string }) {
    const result = await pool.query('DELETE FROM attendance_records WHERE user_id = $1', [where.user_id]);
    return { count: result.rowCount };
  },

  async updateMany(data: { where: any; data: any }) {
    const { where, data: updates } = data;
    let query = 'UPDATE attendance_records SET ';
    const params: any[] = [];
    let paramIndex = 1;

    const updateKeys = Object.keys(updates);
    query += updateKeys.map(k => `${k} = $${paramIndex++}`).join(', ');

    updateKeys.forEach(k => params.push(updates[k]));

    if (where.user_id) {
      query += ` WHERE user_id = $${paramIndex++}`;
      params.push(where.user_id);
    }

    const result = await pool.query(query, params);
    return { count: result.rowCount };
  },
};

/**
 * Raw query execution
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  return pool.query(text, params);
}

/**
 * Transaction helper
 */
export async function transaction(callback: (client: any) => Promise<any>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * End the pool connection
 */
export async function closePool(): Promise<void> {
  return pool.end();
}

/**
 * Run database migrations and create tables if they don't exist
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('Starting database migration...\n');
    
    // Create tables if they don't exist
    const createTableStatements = [
      `CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        admission_no VARCHAR(50),
        registration_no VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, registration_no)
      )`,
      `CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        course_code VARCHAR(50) NOT NULL,
        course_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_code)
      )`,
      `CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        attended_periods INTEGER NOT NULL,
        conducted_periods INTEGER NOT NULL,
        attendance_percentage DECIMAL(5, 2) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, student_id, course_id)
      )`
    ];

    for (const stmt of createTableStatements) {
      try {
        await query(stmt);
        console.log(`✓ Table creation statement executed`);
      } catch (err: any) {
        console.warn(`⚠ Table creation: ${err.message}`);
      }
    }

    // Add indexes for performance
    const statements = [
      'CREATE INDEX IF NOT EXISTS idx_students_user_id ON students (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance_records (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_stats ON attendance_records (user_id, attendance_percentage)',
    ];

    for (const stmt of statements) {
      try {
        await query(stmt);
        console.log(`✓ ${stmt.substring(0, 50)}...`);
      } catch (err: any) {
        // Ignore constraint already exists errors
        if (!err.message.includes('already exists')) {
          console.warn(`⚠ ${stmt.substring(0, 50)}... - ${err.message}`);
        }
      }
    }

    // Handle unique constraints separately  
    const constraints = [
      {
        table: 'students',
        constraint: 'unique_user_registration',
        columns: '(user_id, registration_no)'
      },
      {
        table: 'courses',
        constraint: 'unique_user_course',
        columns: '(user_id, course_code)'
      },
      {
        table: 'attendance_records',
        constraint: 'unique_user_student_course',
        columns: '(user_id, student_id, course_id)'
      }
    ];

    for (const c of constraints) {
      try {
        await query(`ALTER TABLE ${c.table} DROP CONSTRAINT IF EXISTS ${c.constraint}`);
        await query(`ALTER TABLE ${c.table} ADD CONSTRAINT ${c.constraint} UNIQUE ${c.columns}`);
        console.log(`✓ Constraint ${c.constraint} on ${c.table}`);
      } catch (err: any) {
        console.warn(`⚠ Constraint ${c.constraint}: ${err.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('Changes applied:');
    console.log('  • Created tables: students, courses, attendance_records');
    console.log('  • Created indexes for performance');
    console.log('  • Added unique constraints for data isolation');
    
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  }
}
