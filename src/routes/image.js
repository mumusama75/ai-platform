const express = require('express');
const jwt = require('jsonwebtoken');
const { getUserApiKey } = require('./user');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// 获取 API Key 辅助函数
async function getApiKey(req, provider) {
    let apiKey = req.body.apiKey;

    // 如果请求体中没有 Authorization 头，尝试从 header 获取 token 换取 key
    if (!apiKey && req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                apiKey = await getUserApiKey(decoded.id, provider);
            } catch (e) {
                // Token 无效或过期，忽略
            }
        }
    }

    // 特殊处理：如果是 Replicate 且请求头中有 X-API-Key，也可以使用
    if (provider === 'replicate' && !apiKey && req.headers['x-api-key']) {
        apiKey = req.headers['x-api-key'];
    }

    return apiKey;
}

// Gemini Imagen 3 图片生成
router.post('/gemini', async (req, res) => {
    try {
        const { prompt, aspectRatio, negativePrompt } = req.body;
        const apiKey = await getApiKey(req, 'gemini');

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Google API Key' });
        }

        // 构建请求体
        const requestBody = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspectRatio || '1:1',
                negativePrompt: negativePrompt
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || `生成失败: ${response.status} ${response.statusText}`);
        }

        if (!data.predictions || data.predictions.length === 0) {
            throw new Error('API 返回了空的结果');
        }

        // 处理返回的图片 (Base64)
        const images = data.predictions.map(pred => {
            if (pred.bytesBase64Encoded) {
                return `data:image/png;base64,${pred.bytesBase64Encoded}`;
            }
            return null;
        }).filter(img => img !== null);

        res.json({ images });

    } catch (error) {
        console.error('Gemini Image Generation Error:', error);
        res.status(500).json({ error: error.message || '服务器内部错误' });
    }
});

// Replicate 创建任务
router.post('/replicate', async (req, res) => {
    try {
        const { model, input } = req.body;
        const apiKey = await getApiKey(req, 'replicate');

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Replicate API Key' });
        }

        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait' // 尝试等待结果，减少轮询
            },
            body: JSON.stringify({
                version: model.split(':')[1], // 提取 version hash
                input: input
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.error || 'Replicate 请求失败');
        }

        res.json(data);

    } catch (error) {
        console.error('Replicate Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Replicate 查询状态
router.get('/replicate/:id', async (req, res) => {
    try {
        // 对于 GET 请求，key 通常在 header 中
        let apiKey = req.headers['x-api-key'];

        // 如果 header 没有，尝试从用户 token 获取
        if (!apiKey && req.headers.authorization) {
            const token = req.headers.authorization.split(' ')[1];
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                apiKey = await getUserApiKey(decoded.id, 'replicate');
            } catch (e) { }
        }

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Replicate API Key' });
        }

        const response = await fetch(`https://api.replicate.com/v1/predictions/${req.params.id}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || '查询状态失败');
        }

        res.json(data);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SD WebUI 代理 (Custom Endpoint)
router.post('/proxy', async (req, res) => {
    try {
        const { endpoint, body, apiKey } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: '缺少 API 端点' });
        }

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`; // 有些 SD WebUI 配置可能需要 key
        }

        // 防止 SSRF: 简单过滤，仅允许 http/https
        if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
            return res.status(400).json({ error: '无效的端点协议' });
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            // 尝试读取文本错误信息
            const text = await response.text();
            throw new Error(`代理请求失败: ${response.status} - ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message || '代理请求发生错误' });
    }
});

module.exports = router;
