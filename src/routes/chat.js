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

module.exports = router;
