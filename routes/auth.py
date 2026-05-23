from flask import Blueprint, render_template, request, session, redirect, url_for
from werkzeug.security import generate_password_hash
from db import get_db_connection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        db.close()
        if user:
            session['user_id'] = user['id']
            return redirect(url_for('index'))
        return render_template('login.html', error="Username not found")
    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        first_name = request.form['first_name']
        last_name = request.form['last_name']
        phone = request.form['phone']
        password = request.form['password']
        username = request.form['username']

        db = get_db_connection()
        cursor = db.cursor(dictionary=True)

        cursor.execute("SELECT id FROM users WHERE username = %s OR phone = %s", (username, phone))
        existing = cursor.fetchone()
        if existing:
            db.close()
            return render_template('register.html', error="Username or phone already taken")
        
        password_hash = generate_password_hash(password)
        cursor.execute ("INSERT INTO users (username, password_hash, first_name, last_name, phone) VALUES (%s, %s, %s, %s, %s)", (username, password_hash, first_name, last_name, phone))
        db.commit()
        new_id = cursor.lastrowid
        db.close()

        session['user_id'] = new_id
        return redirect(url_for('index'))
    
    return render_template('register.html')