import uuid
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from flask_socketio import SocketIO, emit
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'dev-key-123'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
socketio = SocketIO(app)
UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'tif', 'bmp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
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

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/index')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username FROM users WHERE id != %s", (session['user_id'],))
    users = cursor.fetchall()
    cursor.execute("SELECT username FROM users WHERE id = %s", (session['user_id'],))
    current_user = cursor.fetchone()
    db.close()

    return render_template('index.html', users=users, current_user=current_user)

@app.route('/messages/<int:recipient_id>')
def get_message(recipient_id):
    sender_id = session.get('user_id')
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT sender_id, content, created_at
        FROM messages
        WHERE (sender_id = %s AND receiver_id = %s)
            OR (sender_id = %s AND receiver_id = %s)
        ORDER BY created_at ASC
    """, (sender_id, recipient_id, recipient_id, sender_id))
    messages = cursor.fetchall()
    db.close()

    for msg in messages:
        msg['created_at'] = msg['created_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify({'messages': messages})

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']

    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        url = f"/static/uploads/{filename}"
        return jsonify({'url': url})
    
    return jsonify({'error': 'File type not allowed'}), 400

@socketio.on('send_message')
def handle_message(data):
    sender_id = session.get('user_id')
    message_type = data.get('type', 'text')

    db = get_db_connection()
    cursor = db.cursor()
    sql = "INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES (%s, %s, %s, %s)"
    cursor.execute(sql, (sender_id, data['recipient_id'], data['message'], message_type))
    db.commit()
    db.close()

    emit('receive_message', {
        'message': data['message'],
        'recipient_id': data['recipient_id'],
        'sender_id': sender_id,
        'type': message_type
    }, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)