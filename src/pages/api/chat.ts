import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const { messages } = await request.json();
        const apiKey = import.meta.env.PUBLIC_GEMINI_API_KEY || process.env.PUBLIC_GEMINI_API_KEY;

        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return new Response(JSON.stringify({
                text: "I'm currently in 'offline mode' because no API key was provided. I can still chat using my basic travel knowledge (mock mode), but ask your developer to set up the GEMINI_API_KEY in the .env file for full AI power! 🌍",
                isMock: true
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "You are the DURIAN Travel Assistant. You help users plan luxury European getaways. You are professional, knowledgeable about Schengen visas, boutique hotels, and off-the-beaten-path destinations. Keep responses concise and helpful. Don't mention you are an AI unless asked. Focus on Durian Travel services: custom itineraries, document review, and luxury stays."
        });

        // We'll just take the last message for now to keep it simple, or we can send the whole history
        const userMessage = messages[messages.length - 1].content;
        const result = await model.generateContent(userMessage);
        const responseText = result.response.text();

        return new Response(JSON.stringify({ text: responseText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to generate response' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
