from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'skillswap.db'

app = Flask(__name__, static_folder='.', static_url_path='')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            major TEXT,
            bio TEXT,
            teach_skills TEXT NOT NULL,
            learn_skills TEXT NOT NULL,
            availability TEXT
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            to_user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()


def parse_skills(raw):
    if isinstance(raw, list):
        skills = raw
    else:
        skills = [s.strip() for s in str(raw).split(',')]
    return [s for s in skills if s]


def normalize(skills):
    return {s.strip().lower() for s in skills if s.strip()}


def user_to_dict(row):
    return {
        'id': row['id'],
        'name': row['name'],
        'email': row['email'],
        'major': row['major'] or '',
        'bio': row['bio'] or '',
        'teach_skills': json.loads(row['teach_skills']),
        'learn_skills': json.loads(row['learn_skills']),
        'availability': row['availability'] or ''
    }


@app.route('/')
def root():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/api/init', methods=['POST'])
def api_init():
    init_db()
    return jsonify({'message': 'Database initialized'})


@app.route('/api/reset', methods=['POST'])
def api_reset():
    if DB_PATH.exists():
        DB_PATH.unlink()
    init_db()
    return jsonify({'message': 'Database reset'})


@app.route('/api/seed', methods=['POST'])
def api_seed():
    init_db()
    demo_users = [
        {
            'name': 'Alex Carter',
            'email': 'alex@example.com',
            'major': 'Computer Science',
            'bio': 'I enjoy coding and helping others learn tech skills.',
            'teach_skills': ['Python', 'JavaScript'],
            'learn_skills': ['Excel', 'Financial Modeling'],
            'availability': 'Weekdays after 5 PM'
        },
        {
            'name': 'Maya Singh',
            'email': 'maya@example.com',
            'major': 'Finance',
            'bio': 'Interested in investing, data, and collaboration.',
            'teach_skills': ['Excel', 'Financial Modeling'],
            'learn_skills': ['Python', 'SQL'],
            'availability': 'Tue/Thu afternoons'
        },
        {
            'name': 'Diego Lopez',
            'email': 'diego@example.com',
            'major': 'Marketing',
            'bio': 'Creative designer and branding enthusiast.',
            'teach_skills': ['Canva', 'Graphic Design'],
            'learn_skills': ['Public Speaking', 'Project Management'],
            'availability': 'Evenings'
        },
        {
            'name': 'Priya Patel',
            'email': 'priya@example.com',
            'major': 'Information Systems',
            'bio': 'Love data and building helpful tools.',
            'teach_skills': ['SQL', 'Tableau'],
            'learn_skills': ['Graphic Design', 'Python'],
            'availability': 'Weekends'
        }
    ]

    conn = get_conn()
    cur = conn.cursor()
    for user in demo_users:
        try:
            cur.execute('''
                INSERT INTO users (name, email, major, bio, teach_skills, learn_skills, availability)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                user['name'],
                user['email'],
                user['major'],
                user['bio'],
                json.dumps(user['teach_skills']),
                json.dumps(user['learn_skills']),
                user['availability']
            ))
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()
    return jsonify({'message': 'Demo users seeded'})


@app.route('/api/users', methods=['GET'])
def get_users():
    init_db()
    conn = get_conn()
    rows = conn.execute('SELECT * FROM users ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([user_to_dict(row) for row in rows])


@app.route('/api/users', methods=['POST'])
def create_user():
    init_db()
    data = request.get_json(force=True)
    required = ['name', 'email', 'teach_skills', 'learn_skills']
    for key in required:
        if not data.get(key):
            return jsonify({'error': f'Missing required field: {key}'}), 400

    teach = parse_skills(data.get('teach_skills', []))
    learn = parse_skills(data.get('learn_skills', []))

    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO users (name, email, major, bio, teach_skills, learn_skills, availability)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'],
            data['email'],
            data.get('major', ''),
            data.get('bio', ''),
            json.dumps(teach),
            json.dumps(learn),
            data.get('availability', '')
        ))
        conn.commit()
        user_id = cur.lastrowid
        row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        return jsonify(user_to_dict(row)), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'A user with that email already exists.'}), 409
    finally:
        conn.close()


@app.route('/api/matches/<int:user_id>', methods=['GET'])
def get_matches(user_id):
    init_db()
    conn = get_conn()
    current = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not current:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    current_user = user_to_dict(current)
    current_teach = normalize(current_user['teach_skills'])
    current_learn = normalize(current_user['learn_skills'])

    other_rows = conn.execute('SELECT * FROM users WHERE id != ?', (user_id,)).fetchall()
    matches = []
    for row in other_rows:
        other = user_to_dict(row)
        other_teach = normalize(other['teach_skills'])
        other_learn = normalize(other['learn_skills'])
        they_can_teach_me = sorted(current_learn.intersection(other_teach))
        i_can_teach_them = sorted(current_teach.intersection(other_learn))
        score = len(they_can_teach_me) + len(i_can_teach_them)
        if score > 0:
            other['they_can_teach_me'] = they_can_teach_me
            other['i_can_teach_them'] = i_can_teach_them
            other['match_score'] = score
            matches.append(other)

    matches.sort(key=lambda x: (-x['match_score'], x['name']))
    conn.close()
    return jsonify(matches)


@app.route('/api/requests', methods=['POST'])
def create_request():
    init_db()
    data = request.get_json(force=True)
    required = ['from_user_id', 'to_user_id']
    for key in required:
        if not data.get(key):
            return jsonify({'error': f'Missing required field: {key}'}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO requests (from_user_id, to_user_id, status, message)
        VALUES (?, ?, 'pending', ?)
    ''', (data['from_user_id'], data['to_user_id'], data.get('message', '')))
    conn.commit()
    request_id = cur.lastrowid
    row = conn.execute('SELECT * FROM requests WHERE id = ?', (request_id,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route('/api/requests/<int:user_id>', methods=['GET'])
def list_requests(user_id):
    init_db()
    conn = get_conn()
    rows = conn.execute('''
        SELECT r.id, r.status, r.message, r.created_at,
               sender.name AS from_name, receiver.name AS to_name,
               r.from_user_id, r.to_user_id
        FROM requests r
        JOIN users sender ON sender.id = r.from_user_id
        JOIN users receiver ON receiver.id = r.to_user_id
        WHERE r.from_user_id = ? OR r.to_user_id = ?
        ORDER BY r.created_at DESC, r.id DESC
    ''', (user_id, user_id)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route('/api/requests/<int:request_id>', methods=['PATCH'])
def update_request(request_id):
    init_db()
    data = request.get_json(force=True)
    status = data.get('status')
    if status not in {'accepted', 'declined', 'pending'}:
        return jsonify({'error': 'Status must be accepted, declined, or pending'}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute('UPDATE requests SET status = ? WHERE id = ?', (status, request_id))
    conn.commit()
    row = conn.execute('SELECT * FROM requests WHERE id = ?', (request_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Request not found'}), 404
    return jsonify(dict(row))

import os

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
