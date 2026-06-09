from flask import Flask, render_template, session, redirect, url_for
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from db import get_db_connection
from routes.auth import auth_bp
from routes.contacts import contacts_bp
from routes.messages import messages_bp
import os

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or 'dev-key-123'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
socketio = SocketIO(app)

os.makedirs(os.path.join('static', 'uploads'), exist_ok=True)

app.register_blueprint(auth_bp)
app.register_blueprint(contacts_bp)
app.register_blueprint(messages_bp)

@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return redirect(url_for('auth.login'))

@app.route('/index')
def index():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.id, u.username, u.first_name, u.last_name, u.phone
        FROM users u
        JOIN contacts c ON u.id = c.contact_user_id
        WHERE c.owner_id = %s
    """, (session['user_id'],))
    users = cursor.fetchall()
    cursor.execute("SELECT username, first_name, last_name FROM users WHERE id = %s", (session['user_id'],))
    current_user = cursor.fetchone()
    db.close()

    return render_template('index.html', users=users, current_user=current_user)

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

# ────────────────────── User Room Management ────────────────────
@socketio.on('connect')
def handle_connect():
    user_id = session.get('user_id')
    if user_id:
        from flask_socketio import join_room
        join_room(str(user_id))

@socketio.on('disconnect')
def handle_disconnect():
    user_id = session.get('user_id')
    if user_id:
        from flask_socketio import leave_room
        leave_room(str(user_id))

# ────────────────────── WebRTC Signaling Events ────────────────────
@socketio.on('call_request')
def handle_call_request(data):
    """Forwards an incoming call invitation from Caller to Target Recipient"""
    sender_id = session.get('user_id')
    emit('incoming_call', {
        'sender_id': sender_id,
        'sender_username': data['sender_username'],
        'type': data['type']
    }, to=str(data['target_id']))

@socketio.on('signaling_signal')
def handle_signaling_signal(data):
    """Passes SDP offers, answers, and ICE candidates between clients"""
    sender_id = session.get('user_id')
    emit('receive_signaling', {
        'sender_id': sender_id,
        'target_id': data['target_id'],
        'signal': data['signal']
    }, to=str(data['target_id']))

@socketio.on('call_ended')
def handle_call_ended(data):
    """Notifies the other party that the connection has broken off"""
    emit('remote_call_ended', {} , to=str(data['target_id']))

if __name__ == '__main__':
    socketio.run(app, debug=True)