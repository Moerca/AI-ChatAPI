import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StreamChat } from "stream-chat";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Stream Client
const chatClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!
);

// Initialize Open AI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Register user with Stream Chat
app.post('/register-user', async (reg: Request, res: Response): Promise<any> => {
    const { name, email } = reg.body || {};

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    try {
        const userId = email.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Check if user exists
        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });
        console.log('User query response:', userResponse); // Debugging line

        if (!userResponse.users.length) {
            // Add new user
            await chatClient.upsertUser({
                id: userId,
                name: name,
                email: email,
                role: 'user'
            });
        }

        res.status(200).json({ userId, name, email });

    } catch (error) {
        console.error('Error in register-user route:', error);
        res.status(500).json({ error: 'Internal Server Error'});
    }
});

// Send message to AI chat route
app.post('/chat', async (req: Request, res: Response): Promise<any> => {
    const { message, userId } = req.body;

    if (!message || !userId) {
        return res.status(400).json({ error: 'Message and user are required' });
    }

    try {
        // Verify user exists
        const userResponse = await chatClient.queryUsers({ id: userId });
        console.log('User query response:', userResponse); // Debugging line

        if (!userResponse.users.length) {
            return res.status(404).json({ error: 'User not found. Please register first' });
        }

        // Send message to OpenAI GPT-4
        console.log('Sending message to OpenAI:', message);
        const openAIResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: message }]
        });
        console.log('OpenAI response:', openAIResponse); // Debugging line

        const aiMessage: string = openAIResponse.choices[0].message?.content ?? 'No response from AI';

        // Create or get channel
        const channel = chatClient.channel('messaging', `chat-${userId}`, {
            name: 'AI Chat',
            created_by_id: 'ai_bot'
        });

        try {
            await channel.create();
        } catch (err: any) {
            if (err.message?.includes("already exists")) {
                // Channel already exists, ignore error
                console.log('Channel already exists');
            } else {
                console.error('Error creating channel:', err);
                throw err;
            }
        }

        await channel.sendMessage({ text: aiMessage, user_id: 'ai_bot' });

        res.status(200).json({ reply: aiMessage });

    } catch (error: any) {
        console.error('Error in chat route:', error?.response?.data || error.message || error);
        return res.status(500).json({ error: 'Internal Server Error', details: error?.message });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
