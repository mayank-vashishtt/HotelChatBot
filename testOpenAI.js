const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

// OpenAI Configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function testOpenAI() {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, who won the world series in 2020?" }
      ],
    });

    console.log(completion.data.choices[0].message.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOpenAI();
