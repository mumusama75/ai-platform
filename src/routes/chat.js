const express = require('express');
const jwt = require('jsonwebtoken');
const { getUserApiKey } = require('./user');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Gemini 聊天代理
router.post('/gemini', async (req, res) => {
    try {
        const { apiKey, model, messages, generationConfig } = req.body;

        let geminiApiKey = apiKey;

        // 如果没有提供 API Key，尝试从用户账号获取
        if (!geminiApiKey && req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    geminiApiKey = await getUserApiKey(decoded.id, 'gemini');
                } catch (e) {
                    // Token 验证失败，忽略
                }
            }
        }

        if (!geminiApiKey) {
            return res.status(400).json({ error: '请提供 API Key' });
        }

        // 转换消息格式为 Gemini 格式
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // 调用 Gemini API
        const geminiModel = model || 'gemini-2.0-flash-exp';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: generationConfig?.temperature || 0.7,
                        maxOutputTokens: generationConfig?.maxOutputTokens || 2048
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Gemini API 调用失败');
        }

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        res.json({ content });

    } catch (error) {
        console.error('Gemini 聊天错误:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 提示词优化接口
router.post('/optimize-prompt', async (req, res) => {
    try {
        const { apiKey, prompt } = req.body;
        let geminiApiKey = apiKey;

        // 获取 API Key
        if (!geminiApiKey && req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    geminiApiKey = await getUserApiKey(decoded.id, 'gemini');
                } catch (e) {
                    // Token 验证失败，忽略
                }
            }
        }

        if (!geminiApiKey) {
            return res.status(400).json({ error: '请提供 Google API Key (可使用绘图页面的配置)' });
        }

        if (!prompt) {
            return res.status(400).json({ error: '请提供需要优化的提示词' });
        }

        const systemPrompt = `You are an expert Stable Diffusion Prompt Engineer. 
        Your task is to rewrite the user's simple prompt into a highly detailed, professional English image generation prompt.
        
        Rules:
        1.  Always respond in English.
        2.  Focus on visual descriptors: lighting, texture, camera angle, art style, details.
        3.  Structure your response as a comma-separated list of keywords and phrases.
        4.  Do NOT include explanations, just the prompt itself.
        5.  Target high quality tags like: "masterpiece, best quality, 8k, ultra-detailed".`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: systemPrompt + "\n\nUser Input: " + prompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || '优化请求失败');
        }

        const optimizedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
        res.json({ optimizedPrompt: optimizedPrompt.trim() });

    } catch (error) {
        console.error('Prompt Optimization Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
