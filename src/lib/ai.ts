import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'default_dummy_key_in_dev_propsathi',
});

/**
 * Generates a 768-dimensional embedding vector for property matching.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const cleanText = text.replace(/\n/g, ' ').trim();
    if (!cleanText) {
      return new Array(768).fill(0);
    }

    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: cleanText,
    });

    // Access the embedding values returned by the SDK
    const embedding = response.embedding || (response.embeddings && response.embeddings[0]);
    if (!embedding || !embedding.values) {
      throw new Error('No embedding values returned from Gemini API');
    }

    return embedding.values;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

export interface AIAnalysisResult {
  intent: 'buying' | 'renting' | 'browsing' | 'complaint' | 'spam' | 'other';
  score: 'hot' | 'warm' | 'cold';
  reasoning: string;
  extracted_parameters: {
    budget?: number;
    location?: string;
    bedrooms?: number;
  };
  draft_reply: string;
}

/**
 * Invokes gemini-2.5-flash in structured JSON output mode to analyze a message.
 */
export async function analyzeLeadMessage(
  messageContent: string,
  historyText: string,
  listingsText: string,
  clientTone = 'professional, helpful, and warm'
): Promise<AIAnalysisResult> {
  const prompt = `
You are the AI processing layer of PropSathi, a multi-tenant real estate CRM.
Your job is to analyze the incoming message from a lead, score it, classify the intent, extract search parameters if any, and draft a response in the client's tone.

Tenant Tone instructions: Use a "${clientTone}" tone.

Here is the conversation history so far:
---
${historyText || '[No previous conversation history]'}
---

Here is the new inbound message:
"${messageContent}"

Here are the top matched properties that you can reference in the response if relevant (do NOT make up properties that are not listed here):
---
${listingsText || '[No matched properties available]'}
---

Return your analysis strictly in the requested JSON structure.
If you refer to properties, mention their title, price, and location. If the user intent is SPAM, set the score to COLD and draft a polite warning or ignore.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['buying', 'renting', 'browsing', 'complaint', 'spam', 'other']
            },
            score: {
              type: 'string',
              enum: ['hot', 'warm', 'cold']
            },
            reasoning: {
              type: 'string'
            },
            extracted_parameters: {
              type: 'object',
              properties: {
                budget: { type: 'number' },
                location: { type: 'string' },
                bedrooms: { type: 'integer' }
              }
            },
            draft_reply: {
              type: 'string'
            }
          },
          required: ['intent', 'score', 'reasoning', 'draft_reply']
        }
      }
    });

    const textOutput = response.text || '';
    if (!textOutput) {
      throw new Error('Empty response text from Gemini model');
    }

    return JSON.parse(textOutput) as AIAnalysisResult;
  } catch (error) {
    console.error('Gemini text generation failed:', error);
    throw error;
  }
}
