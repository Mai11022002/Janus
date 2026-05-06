from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-123')
socketio = SocketIO(app)

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

@app.route('/')
def index():
    # Hardcode it first
    session['user_id'] = 1

    #if 'user_id' not in session:
    #    return "Please log in (Login logic to be added)"
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username FROM users WHERE id != %s", (session['user_id'],))
    users = cursor.fetchall()
    db.close()

    return render_template('index.html', users=users)

@socketio.on('send_message')
def handle_message(data):
    sender_id = session.get('user_id')

    db = get_db_connection()
    cursor = db.cursor()
    sql = "INSERT INTO messages (sender_id, receiver_id, content) VALUES (%s, %s, %s)"
    cursor.execute(sql, (sender_id, data['recipient_id'], data['message']))
    db.commit()
    db.close()

    emit('receive_message', data, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)