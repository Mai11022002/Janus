import uuid
import os
from flask import Blueprint, request, session, jsonify
from db import get_db_connection

messages_bp = Blueprint('messages', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'tif', 'bmp', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@messages_bp.route('/messages/<int:recipient_id>')
def get_message(recipient_id):
    sender_id = session.get('user_id')
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT sender_id, content, created_at, message_type, status
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

@messages_bp.route('/upload', methods=['POST'])
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

@messages_bp.route('/delete_chat/<int:contact_id>', methods=['POST'])
def delete_chat(contact_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    sender_id = session['user_id']
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("""
        DELETE FROM messages
        WHERE (sender_id = %s AND receiver_id = %s) OR (sender_id = %s AND receiver_id = %s)
    """, (sender_id, contact_id, contact_id, sender_id))
    db.commit()
    db.close()
    return jsonify({'success': True})

@messages_bp.route('/status/<int:sender_id>', methods=['POST'])
def status(sender_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    receiver_id = session['user_id']
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("""
        UPDATE messages SET status = 'read'
        WHERE sender_id = %s AND receiver_id = %s AND status != 'read'
    """, (sender_id, receiver_id))
    db.commit()
    db.close()
    return jsonify({'success': True})

@messages_bp.route('/messages/group/<int:group_id>')
def get_group_messages(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT m.sender_id, u.username AS sender_username, m.content, m.created_at, m.message_type, m.status
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.group_id = %s
        ORDER BY m.created_at ASC
    """, (group_id,))
    messages = cursor.fetchall()
    db.close()

    for msg in messages:
        msg['created_at'] = msg['created_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify({'messages': messages})

@messages_bp.route('/groups/create', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    group_name = data.get('name', '').strip()
    member_ids = data.get('members', []) 

    if not group_name:
        return jsonify({'error': 'Group name is required'}), 400

    creator_id = session['user_id']
    db = get_db_connection()
    cursor = db.cursor()

    try:
        cursor.execute("INSERT INTO chat_groups (name, created_by) VALUES (%s, %s)", (group_name, creator_id))
        group_id = cursor.lastrowid
        all_members = set(member_ids)
        all_members.add(creator_id)

        for u_id in all_members:
            cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)", (group_id, int(u_id)))       
        db.commit()
        return jsonify({'success': True, 'group_id': group_id, 'name': group_name})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@messages_bp.route('/groups/<int:group_id>/manage_member', methods=['POST'])
def manage_member(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json() or {}
    action = data.get('action') 
    target_user_id = data.get('user_id')

    if not action or not target_user_id:
        return jsonify({'error': 'Missing parameters'}), 400
    db = get_db_connection()
    cursor = db.cursor()

    try:
        if action == 'add':
            cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (%s, %s)", (group_id, int(target_user_id)))
        elif action == 'kick':
            cursor.execute("DELETE FROM group_members WHERE group_id = %s AND user_id = %s", (group_id, int(target_user_id)))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@messages_bp.route('/groups/<int:group_id>/delete', methods=['POST'])
def delete_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401       
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM group_members WHERE group_id = %s", (group_id,))
        cursor.execute("DELETE FROM messages WHERE group_id = %s", (group_id,))
        cursor.execute("DELETE FROM chat_groups WHERE id = %s", (group_id,))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()