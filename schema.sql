CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSON, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

USE messenger;

INSERT INTO users (username, password_hash) VALUES ('AlgonquinCoder', 'hashed_pass_123');
INSERT INTO users (username, password_hash) VALUES ('OttawaDev', 'hashed_pass_456');
INSERT INTO users (username, password_hash) VALUES ('User_3', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_4', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_5', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_6', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_7', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_8', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_9', 'pbkdf2:sha256:password123');
INSERT INTO users (username, password_hash) VALUES ('User_10', 'pbkdf2:sha256:password123');

INSERT INTO messages (sender_id, receiver_id, content, metadata) VALUES (1, 2, 'Hey! Check out this JSON feature.', '{"device": "PC", "status": "sent", "priority": 1}');

ALTER TABLE messages ADD COLUMN message_type VARCHAR(10) DEFAULT 'text';
UPDATE messages SET message_type = 'image' WHERE content LIKE '/static/uploads/%';