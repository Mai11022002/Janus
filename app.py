from flask import Flask, render_template, session, redirect, url_for, request, jsonify
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
        SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.is_online, u.last_seen, c.blocked, c.muted,
            (SELECT m.content FROM messages m
            WHERE ((m.sender_id = %s AND m.receiver_id = u.id) OR (m.sender_id = u.id AND m.receiver_id = %s))
                AND m.group_id IS NULL
            ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM messages m
            WHERE m.sender_id = u.id AND m.receiver_id = %s AND m.status != 'read' AND m.group_id IS NULL
            ) AS unread_count
        FROM users u
        JOIN contacts c ON u.id = c.contact_user_id
        WHERE c.owner_id = %s
    """, (session['user_id'], session['user_id'], session['user_id'], session['user_id']))
    users = cursor.fetchall()

    cursor.execute("""
        SELECT g.id, g.name, g.created_by
        FROM chat_groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = %s
    """, (session['user_id'],))
    groups = cursor.fetchall()
    cursor.execute("SELECT username, first_name, last_name, theme FROM users WHERE id = %s", (session['user_id'],))
    current_user = cursor.fetchone()
    db.close()

    return render_template('index.html', users=users, groups=groups, current_user=current_user)

@app.route('/update_theme', methods=['POST'])
def update_theme():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    theme = request.json.get('theme')
    if theme not in ('light', 'dark'):
        return jsonify({'error': 'Invalid theme'}), 400
    
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE users SET theme = %s WHERE id = %s", (theme, session['user_id']))
        db.commit()
        return jsonify({'success': True, 'theme': theme})
    except Exception as e:
        db.rollback()
        print(f"Error updating theme: {str(e)}")
        return jsonify({'error': 'Failed to update theme'}), 500
    finally:
        db.close()

@socketio.on('send_message')
def handle_message(data):
    sender_id = session.get('user_id')
    message_type = data.get('type', 'text')
    recipient_target = data.get('recipient_id')

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # Fetch the sender's username for the notification
    cursor.execute("SELECT username FROM users WHERE id = %s", (sender_id,))
    sender_info = cursor.fetchone()
    sender_username = sender_info['username'] if sender_info else f"User {sender_id}"

    if isinstance(recipient_target, str) and recipient_target.startswith('group-'):
        group_id = int(recipient_target.replace('group-', ''))
        sql = "INSERT INTO messages (sender_id, group_id, content, message_type) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql, (sender_id, group_id, data['message'], message_type))
        db.commit()
        db.close()

        emit('receive_message', {
            'message': data['message'],
            'recipient_id': recipient_target,
            'sender_id': sender_id,
            'sender_username': sender_username,
            'type': message_type,
            'is_group': True
        }, broadcast=True)
    else:
        recipient_id = int(recipient_target)
        cursor.execute("""
            SELECT owner_id, blocked FROM contacts
            WHERE (owner_id = %s AND contact_user_id = %s)
                OR (owner_id = %s AND contact_user_id = %s)
        """, (sender_id, recipient_id, recipient_id, sender_id))
        block_rows = cursor.fetchall()
        db.close()

        sender_blocked_recipient = any(r['blocked'] and r['owner_id'] == sender_id for r in block_rows)
        recipient_blocked_sender = any(r['blocked'] and r['owner_id'] == recipient_id for r in block_rows)

        if sender_blocked_recipient:
            emit('message_blocked', {
                'recipient_id': recipient_id,
                'reason': 'you_blocked_them'
            }, to=str(sender_id))
            return
        
        if recipient_blocked_sender:
            emit('message_blocked', {
                'sender_id': sender_id,
                'reason': 'blocked_contact_attempted'
            }, to=str(recipient_id))
            return
        
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        sql = "INSERT INTO messages (sender_id, receiver_id, content, message_type) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql, (sender_id, recipient_id, data['message'], message_type))
        db.commit()
        db.close()

        payload = {
            'message': data['message'],
            'recipient_id': recipient_id,
            'sender_id': sender_id,
            'sender_username': sender_username,
            'type': message_type,
            'is_group': False
        }

        emit('receive_message', payload, to=str(recipient_target))
        emit('receive_message', payload, to=str(sender_id))

# ────────────────────── User Room Management ────────────────────
@socketio.on('connect')
def handle_connect():
    user_id = session.get('user_id')
    if user_id:
        from flask_socketio import join_room
        join_room(str(user_id))

        # Update user status to online in the DB
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("UPDATE users SET is_online = TRUE WHERE id = %s", (user_id,))
        db.commit()
        db.close()

        # Broadcast presence change status to all connected users
        emit('user_status_change', {
            'user_id': user_id,
            'is_online': True,
            'last_seen': None
        }, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    user_id = session.get('user_id')
    if user_id:
        from flask_socketio import leave_room
        leave_room(str(user_id))

        import datetime
        now = datetime.datetime.now()

        # Update user status to offline and capture timestamp
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute("UPDATE users SET is_online = FALSE, last_seen = %s WHERE id = %s", (now, user_id,))
        db.commit()
        db.close()

        # Broadcast departure information across the pipeline
        emit('user_status_change', {
            'user_id': user_id,
            'is_online': False,
            'last_seen': now.strftime('%Y-%m-%d %H:%M:%S')
        }, broadcast=True)

# ────────────────────── Typing Indicator Events ────────────────────
@socketio.on('typing_status')
def handle_typing_status(data):
    sender_id = session.get('user_id')
    recipient_id = data.get('recipient_id')
    is_typing = data.get('is_typing', False)

    sender_username = session.get('username', f"User {sender_id}")

    if sender_id and recipient_id:
        emit('display_typing', {
            'sender_id': sender_id,
            'sender_username': sender_username,
            'is_typing': is_typing
        }, to=str(recipient_id))

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