# Janus

A full-stack, real-time messenger app, 1-on-1 and group chat, file sharing, presence, and WebRTC calling, built from scratch with Python and vanilla JavaScript.

🔗 **Live demo:** https://janus-production-59d8.up.railway.app

> Still under active development (started May 2026). Core messaging works; a few features below are explicitly in progress — see Known Issues.

## Features

- User registration and login
- Real-time 1-on-1 messaging over WebSockets (no page reloads)
- Group chat: create groups, add/remove members
- Contact management: add, delete, block, mute
- Photo and PDF sharing in chats
- Message status tracking (sent / delivered / read)
- Online/offline presence, with last-seen timestamps
- WebRTC audio/video calling (see Known Issues)

## Stack

- **Backend:** Python, Flask, Flask-SocketIO (WebSockets), MySQL
- **Frontend:** Vanilla JavaScript, Jinja2 templates, custom CSS — no framework
- **Real-time:** Socket.IO for messaging/presence, WebRTC for calls
- **Hosted on Railway** — Flask app and MySQL database both deployed as live services

## Known issues / actively being worked on

- WebRTC calling works from the caller's side; the receiver's side isn't fully working yet
- "User is typing..." indicator isn't working yet
- Real-time presence system is implemented but may have edge-case bugs
- Login currently doesn't verify the submitted password against the stored hash — a fix in progress

## Roadmap

- Starred/pinned messages, "select chats," "mark all as read," app lock
- End-to-end message encryption
- Multi-factor authentication
- Mobile (Android/iOS) client
- Horizontal scaling for concurrent users

## Run locally

```bash
git clone https://github.com/Mai11022002/Janus.git
cd Janus
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your own MySQL credentials, then run `schema.sql` against your local MySQL database (MySQL Workbench works fine). Start the app with:

```bash
python app.py
```
