import OpenAI from "openai";
import { OPENAI_API_KEY } from "../config/env";
import { Buffer } from "buffer";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY});

export async function analyzeChangeWithAI(previousBuffer: Buffer | null, currentBuffer: Buffer, target_url: string): Promise<string> {
    const previousBase64 = previousBuffer ? previousBuffer.toString('base64') : null;

    const currentBase64 = currentBuffer.toString('base64');

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `You are comparing two screenshots of the same webpage (${target_url}) taken at different times. ${previousBase64 ? 'The PREVIOUS screenshot is provided first, then the CURRENT screenshot.' : 'This is the first screenshot - no previous image available.'} Analyze what changed. Focus on: content changes (text, numbers, images), layout shifts, or errors visible. Provide a concise most 3-4 sentence summary of the most important change.`
                },
                ...(previousBase64 
                ? [{
                        type: 'image_url' as const,
                        image_url: {
                            url: `data:image/png;base64,${previousBase64}`,
                            detail: 'auto' as const
                        }
                    }]
                    : []),
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${currentBase64}`,
                            detail: 'auto'
                        }
                    }
            ]
        }
    ];
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
    });

    return response.choices[0]?.message?.content ?? 'Change detected on your tracked webpage.';
}