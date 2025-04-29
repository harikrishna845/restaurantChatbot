import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './chatinterface.css';

interface MenuItem {
  'Item Name': string;
  'Price (INR)': number;
  'Ratings'?: number;
  'Category'?: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<string[]>([
    '🤖 Brothers Restaurant\n👋 Welcome! Type anything to begin your order.'
  ]);
  const [input, setInput] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [awaitingTableNumber, setAwaitingTableNumber] = useState(false);
  const [awaitingInitialInput, setAwaitingInitialInput] = useState(true);
  const [awaitingNote, setAwaitingNote] = useState(false);
  const [note, setNote] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [awaitingQuantityItem, setAwaitingQuantityItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    fetch('/menu.xlsx')
      .then(res => res.arrayBuffer())
      .then(ab => {
        const wb = XLSX.read(ab, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<MenuItem>(sheet);
        setMenuItems(json);
      });
  }, []);

  const handleUserInput = (userInput: string) => {
    setMessages(prev => [...prev, `🧑‍💼 ${userInput}`]);

    if (awaitingInitialInput) {
      setMessages(prev => [...prev, '🤖 Please enter your table number:']);
      setAwaitingTableNumber(true);
      setAwaitingInitialInput(false);
      return;
    }

    if (awaitingTableNumber) {
      setTableNumber(userInput);
      setMessages(prev => [
        ...prev,
        `🤖 Thank you! Table number ${userInput} registered.`,
        '🤖 Now choose an option:\n- Menu\n- Top Rated Items\n- Drinks\n- Let me suggest'
      ]);
      setAwaitingTableNumber(false);
      setShowOptions(true);
      return;
    }

    if (awaitingQuantityItem) {
      const quantity = parseInt(userInput);
      if (!isNaN(quantity) && quantity > 0) {
        const updatedItems = [...orderItems];
        const index = updatedItems.findIndex(i => i.name === awaitingQuantityItem['Item Name']);
        if (index >= 0) {
          updatedItems[index].quantity += quantity;
        } else {
          updatedItems.push({
            name: awaitingQuantityItem['Item Name'],
            quantity,
            price: awaitingQuantityItem['Price (INR)']
          });
        }
        setOrderItems(updatedItems);
        setMessages(prev => [...prev, `🤖 Added ${quantity} x ${awaitingQuantityItem['Item Name']} to your order.`]);
      } else {
        setMessages(prev => [...prev, '⚠️ Please enter a valid number.']);
      }
      setAwaitingQuantityItem(null);
      return;
    }

    if (awaitingNote) {
      setNote(userInput);
      placeOrder(userInput);
      setAwaitingNote(false);
      return;
    }

    const matchedItem = menuItems.find(item => item['Item Name'].toLowerCase() === userInput.toLowerCase());
    if (matchedItem) {
      setAwaitingQuantityItem(matchedItem);
      setMessages(prev => [...prev, `🤖 How much quantity of ${matchedItem['Item Name']} would you like?..in plates/anything`]);
      return;
    }

    let response = "⚠️ I didn’t understand. Please choose from the available options.";

    if (userInput === 'Menu') {
      response = menuItems.length
        ? menuItems.map(item => `🍽 ${item['Item Name']} - ₹${item['Price (INR)']}`).join('\n')
        : '⚠️ Menu not available right now.';
    } else if (userInput === 'Top Rated Items') {
      const topRated = [...menuItems]
        .filter(item => item['Ratings'] !== undefined)
        .sort((a, b) => (b['Ratings'] || 0) - (a['Ratings'] || 0))
        .slice(0, 5);
      response = topRated.map(item => `🌟 ${item['Item Name']} - ₹${item['Price (INR)']} (⭐ ${item['Ratings']})`).join('\n');
    } else if (userInput === 'Drinks') {
      const drinks = menuItems.filter(item => item['Category']?.toLowerCase().includes('drink'));
      response = drinks.map(item => `🥤 ${item['Item Name']} - ₹${item['Price (INR)']}`).join('\n');
    } else if (userInput === 'Let me suggest') {
      const now = new Date();
      const hour = now.getHours();

      let category = '';
      if (hour >= 6 && hour < 11) category = 'breakfast';
      else if (hour >= 11 && hour < 16) category = 'drinks';
      else if (hour >= 16 && hour < 18) category = 'snacks';
      else if (hour >= 18 && hour < 22) category = 'dinner';

      let suggestions: MenuItem[] = [];

      if (category) {
        suggestions = menuItems.filter(item =>
          item['Category']?.toLowerCase().includes(category)
        );
      }

      // Add drinks if it's between 11 and 16
      if (hour >= 11 && hour < 16) {
        const drinks = menuItems.filter(item =>
          item['Category']?.toLowerCase().includes('drink')
        );
        suggestions = [...suggestions, ...drinks];
      }

      const random = suggestions.length > 0
        ? suggestions[Math.floor(Math.random() * suggestions.length)]
        : menuItems[Math.floor(Math.random() * menuItems.length)];

      setAwaitingQuantityItem(random);
      setMessages(prev => [
        ...prev,
        `🤖 🧠 Let me suggest: ${random['Item Name']} - ₹${random['Price (INR)']}\nHow much quantity would you like?..in plates/anything`
      ]);
      return;
    } else if (userInput === 'Order') {
      if (orderItems.length === 0) {
        setMessages(prev => [...prev, `🤖 You haven't selected any items yet.`]);
        return;
      }
      setMessages(prev => [...prev, '📝 Any note for the kitchen? (e.g. Less spicy, extra napkins)']);
      setAwaitingNote(true);
      return;
    }

    setMessages(prev => [...prev, `🤖 ${response}`]);
  };

  const placeOrder = (note: string) => {
    const totalCost = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const formattedItems = orderItems.map(item => `${item.name} x${item.quantity}`);

    const orderData = {
      tableNumber,
      items: formattedItems,
      totalCost,
      note
    };

    fetch('http://localhost:5000/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const summary = [
      '✅ Order placed successfully!',
      '📝 Items Ordered:',
      ...formattedItems.map(item => ` - ${item}`),
      `💰 Total Cost: ₹${totalCost}`
    ];

    setMessages(prev => [...prev, ...summary]);
    setOrderItems([]);
    setNote('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleUserInput(input.trim());
    setInput('');
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-header">Brothers Restaurant</div>
      <div className="chat-box">
        {messages.map((msg, i) => (
          <div key={i} className={msg.startsWith('🧑‍💼') ? 'user-msg' : 'bot-msg'}>
            {msg}
          </div>
        ))}
      </div>
      <form className="input-area" onSubmit={handleSubmit}>
        {showOptions && (
          <div className="quick-options">
            {['Menu', 'Top Rated Items', 'Drinks', 'Let me suggest',  'Order'].map(opt => (
              <button key={opt} type="button" onClick={() => handleUserInput(opt)}>{opt}</button>
            ))}
          </div>
        )}
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit">📤</button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
