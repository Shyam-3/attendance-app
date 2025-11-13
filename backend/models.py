from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Student(db.Model):
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    admission_no = db.Column(db.String(50), nullable=False)
    registration_no = db.Column(db.String(50), nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to attendance records
    attendance_records = db.relationship('AttendanceRecord', backref='student', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Student {self.name} - {self.registration_no}>'

class Course(db.Model):
    __tablename__ = 'courses'
    
    id = db.Column(db.Integer, primary_key=True)
    course_code = db.Column(db.String(20), nullable=False, unique=True)
    course_name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to attendance records
    attendance_records = db.relationship('AttendanceRecord', backref='course', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Course {self.course_code} - {self.course_name}>'

class AttendanceRecord(db.Model):
    __tablename__ = 'attendance_records'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    attended_periods = db.Column(db.Integer, nullable=False)
    conducted_periods = db.Column(db.Integer, nullable=False)
    attendance_percentage = db.Column(db.Float, nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure unique combination of student and course
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='unique_student_course'),)
    
    @property
    def is_below_threshold(self):
        return self.attendance_percentage < 75.0
    
    def __repr__(self):
        return f'<AttendanceRecord {self.student.name} - {self.course.course_code}: {self.attendance_percentage}%>'

def init_db(app):
    """Initialize the database with the Flask app"""
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        print("Database tables created successfully!")