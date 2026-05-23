import uuid
import os
from flask import Blueprint, request, session, jsonify
from db import get_db_connection

messages_bp = Blueprint('messages', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'tif', 'bmp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@messages_bp.route('/messages/<int:recipient_id>')
def get_message(recipient_id):
    sender_id = session.get('user_id')
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT sender_id, content, created_at, message_type
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