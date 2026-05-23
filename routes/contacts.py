from flask import Blueprint, request, session, jsonify
from db import get_db_connection

contacts_bp = Blueprint('contacts', __name__)

@contacts_bp.route('/add_contact', methods=['POST'])
def add_contact():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    first_name = request.form.get('first_name', '').strip()
    last_name = request.form.get('last_name', '').strip()
    phone = request.form.get('phone', '').strip()
    owner_id = session['user_id']

    if not phone:
        return jsonify({'error': 'Phone number is required'}), 400
    if not first_name and not last_name:
        return jsonify({'error': 'At least first or last name is required'}), 400
    
    if first_name and last_name:
        display_name = f"{last_name} {first_name}"
    elif last_name:
        display_name = last_name
    else:
        display_name = first_name

    username = display_name
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT id FROM users WHERE phone = %s", (phone,))
    if cursor.fetchone():
        db.close()
        return jsonify({'error': 'Phone number already registered'}), 400
    try:
        dummy_hash = "LOCKED_PLACEHOLDER"
        cursor.execute("""INSERT INTO users (username, password_hash, first_name, last_name, phone) VALUES (%s, %s, %s, %s, %s)""", (username, dummy_hash, first_name, last_name, phone))
        db.commit()
        new_user_id = cursor.lastrowid

        if new_user_id == owner_id:
            return jsonify({'error': 'You cannot add yourself'}), 400
        
        cursor.execute("INSERT INTO contacts (owner_id, contact_user_id) VALUES (%s, %s)", (owner_id, new_user_id))
        db.commit()
        return jsonify({
            'success': True,
            'user': {
                'id': new_user_id,
                'username': username,
                'first_name': first_name,
                'last_name': last_name
            }
        })
    except Exception as e:
        return jsonify({'error': 'Contact already in your list'}), 400
    finally:
        db.close()

@contacts_bp.route('/delete_contact/<int:contact_id>', methods=['POST'])
def delete_contact(contact_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    owner_id = session['user_id']
    db = get_db_connection()
    cursor = db.cursor()

    try:
        cursor.execute ("""
            DELETE FROM messages
            WHERE (sender_id = %s AND receiver_id = %s) OR (sender_id = %s AND receiver_id = %s)
        """, (owner_id, contact_id, contact_id, owner_id))

        cursor.execute("""
            DELETE FROM contacts
            WHERE (owner_id = %s AND contact_user_id = %s) OR (owner_id = %s AND contact_user_id = %s)
        """, (owner_id, contact_id, contact_id, owner_id))

        cursor.execute("DELETE FROM users WHERE id = %s", (contact_id,))

        db.commit()
        return jsonify({'success': True})
    
    except Exception as e:
        db.rollback()
        print(f"Error deleting the contact: {str(e)}")
        return jsonify({'error': 'Failed to permanently delete contact data'}), 500
    finally:
        db.close()