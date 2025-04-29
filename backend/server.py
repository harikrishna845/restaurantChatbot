from flask import Flask, request
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# 🔧 Initialize SQLite database
def init_db():
    conn = sqlite3.connect('orders.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            table_number TEXT,
            items TEXT,
            total_cost REAL,
            note TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# 🛒 Order receiving route
@app.route('/order', methods=['POST'])
def receive_order():
    data = request.json
    table_number = data.get('tableNumber')
    items = data.get('items', [])
    total_cost = data.get('totalCost')
    note = data.get('note', '')

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ✅ Safely format items for storing and display
    items_str_list = []
    for item in items:
        if isinstance(item, dict):
            name = item.get('name', 'Unknown')
            qty = item.get('quantity', 1)
            price = item.get('price', 0)
            items_str_list.append(f"{name} ({qty}) - ₹{price}")
        else:
            # Handle case where item is a plain string
            items_str_list.append(str(item))

    items_str = ', '.join(items_str_list)

    # ✅ 1. Print to terminal
    print("\n✅ NEW ORDER RECEIVED")
    print(f"🕒 Time: {timestamp}")
    print(f"🪑 Table Number: {table_number}")
    print("🍽️  Items Ordered:")
    for line in items_str_list:
        print(f"   - {line}")
    print(f"💰 Total Cost: ₹{total_cost}")
    print(f"📝 Notes: {note}")

    # ✅ 2. Save to SQLite
    conn = sqlite3.connect('orders.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO orders (timestamp, table_number, items, total_cost, note)
        VALUES (?, ?, ?, ?, ?)
    ''', (timestamp, table_number, items_str, total_cost, note))
    conn.commit()
    conn.close()

    # ✅ 3. Save to JSON file
    order = {
        'timestamp': timestamp,
        'tableNumber': table_number,
        'items': items,
        'totalCost': total_cost,
        'note': note
    }

    if os.path.exists('orders.json'):
        with open('orders.json', 'r') as f:
            try:
                orders = json.load(f)
            except json.JSONDecodeError:
                orders = []
    else:
        orders = []

    orders.append(order)
    with open('orders.json', 'w') as f:
        json.dump(orders, f, indent=2)

    return {'message': 'Order received and saved'}, 200

if __name__ == '__main__':
    app.run(debug=True)
