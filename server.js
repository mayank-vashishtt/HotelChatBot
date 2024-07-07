const express = require('express');
const OpenAI = require('openai');
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Database setup
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
});

// Define Conversation model
const Conversation = sequelize.define('Conversation', {
  userId: DataTypes.STRING,
  messages: DataTypes.TEXT,
});

// Sync database
sequelize.sync();

// Function to get rooms
async function getRooms() {
  try {
    const response = await axios.get('https://bot9assignement.deno.dev/rooms');
    return response.data;
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return [];
  }
}

// Function to book a room
async function bookRoom(roomId, fullName, email, nights) {
  try {
    const response = await axios.post('https://bot9assignement.deno.dev/book', {
      roomId,
      fullName,
      email,
      nights,
    });
    return response.data;
  } catch (error) {
    console.error('Error booking room:', error);
    return null;
  }
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message, userId } = req.body;

  // Retrieve or create conversation history
  let conversation = await Conversation.findOne({ where: { userId } });
  if (!conversation) {
    conversation = await Conversation.create({ userId, messages: '[]' });
  }

  let messages = JSON.parse(conversation.messages);
  messages.push({ role: 'user', content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for hotel bookings.' },
        ...messages,
      ],
      functions: [
        {
          name: 'get_rooms',
          description: 'Get available hotel rooms',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'book_room',
          description: 'Book a hotel room',
          parameters: {
            type: 'object',
            properties: {
              roomId: { type: 'number' },
              fullName: { type: 'string' },
              email: { type: 'string' },
              nights: { type: 'number' },
            },
            required: ['roomId', 'fullName', 'email', 'nights'],
          },
        },
      ],
      function_call: 'auto',
    });

    let assistantMessage = completion.choices[0].message;

    if (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

      let functionResult;
      if (functionName === 'get_rooms') {
        functionResult = await getRooms();
      } else if (functionName === 'book_room') {
        functionResult = await bookRoom(
          functionArgs.roomId,
          functionArgs.fullName,
          functionArgs.email,
          functionArgs.nights
        );
      }

      messages.push(assistantMessage);
      messages.push({
        role: 'function',
        name: functionName,
        content: JSON.stringify(functionResult),
      });

      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
      });

      assistantMessage = secondCompletion.choices[0].message;
    }

    messages.push(assistantMessage);

    // Update conversation history
    await conversation.update({ messages: JSON.stringify(messages) });

    res.json({ response: assistantMessage.content });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));