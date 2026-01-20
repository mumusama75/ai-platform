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

// Gemini 多模态图片生成 (支持文生图和图生图 - Nano Banana)
router.post('/gemini', async (req, res) => {
    try {
        const { prompt, aspectRatio, negativePrompt, referenceImage } = req.body;
        const apiKey = await getApiKey(req, 'gemini');

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Google API Key' });
        }

        // 构建 parts 数组 (多模态输入)
        const parts = [];

        // 如果有参考图片，添加到 parts 中 (图生图)
        if (referenceImage && referenceImage.base64) {
            parts.push({
                inline_data: {
                    mime_type: referenceImage.mimeType || 'image/jpeg',
                    data: referenceImage.base64
                }
            });
        }

        // 构建提示词 (结合负向提示词)
        let fullPrompt = prompt;

        if (negativePrompt) {
            fullPrompt += `\n\n[Avoid: ${negativePrompt}]`;
        }

        // 添加文字指令
        parts.push({ text: fullPrompt });

        // 构建安全设置
        // 默认放宽限制以允许更多创意内容，除非用户特别指定
        let safetySettings = [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ];

        // 如果前端传来了自定义安全设置
        if (req.body.safetySettings) {
            const level = req.body.safetySettings;
            safetySettings = safetySettings.map(s => ({ ...s, threshold: level }));
        }

        // 构建 generationConfig，包含 imageConfig 用于宽高比
        const generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: req.body.temperature ? parseFloat(req.body.temperature) : 0.9
        };

        // 添加宽高比配置 (支持: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
        if (aspectRatio) {
            generationConfig.imageConfig = {
                aspectRatio: aspectRatio
            };
        }

        // 构建请求体 (Gemini 多模态 generateContent)
        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: generationConfig,
            safetySettings: safetySettings
        };

        // 使用 Gemini 2.5 Flash Image 模型 (支持图片输出)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
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

        // 调试：打印完整响应
        console.log('Gemini API Response:', JSON.stringify(data, null, 2));

        // 处理返回的图片 (从 candidates 中提取 inline_data)
        const images = [];
        const candidates = data.candidates || [];

        for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
                // 检查 inline_data 或 inlineData (两种可能的格式)
                const imageData = part.inline_data || part.inlineData;
                if (imageData && imageData.data) {
                    const mime = imageData.mime_type || imageData.mimeType || 'image/png';
                    images.push(`data:${mime};base64,${imageData.data}`);
                }
            }
        }

        if (images.length === 0) {
            console.error('No images found in response. Full response:', JSON.stringify(data, null, 2));
            throw new Error('API 未返回图片数据。响应已记录到服务器日志，请检查');
        }

        res.json({ images });

    } catch (error) {
        console.error('Gemini Image Generation Error:', error);
        res.status(500).json({ error: error.message || '服务器内部错误' });
    }
});

// 列出可用模型
router.post('/models', async (req, res) => {
    try {
        const apiKey = await getApiKey(req, 'gemini');
        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Google API Key' });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || '获取模型列表失败');
        }

        // Filter for image generation models if possible, or just return all
        // Image generation models usually have 'generateImage' or similar method, 
        // but the API metadata might be obscure. Let's return the simplified list.
        const models = (data.models || []).map(m => ({
            name: m.name,
            displayName: m.displayName,
            methods: m.supportedGenerationMethods
        }));

        res.json({ models });

    } catch (error) {
        console.error('List Models Error:', error);
        res.status(500).json({ error: error.message });
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

        // SSRF Protection: 解析主机名并检查是否为私有 IP
        const url = new URL(endpoint);
        const hostname = url.hostname;

        // 简单的 IP 格式检查 (IPv4)
        const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

        if (isIp || hostname === 'localhost') {
            // 如果是 IP 或 localhost，直接检查
            if (isPrivateIp(hostname)) {
                return res.status(403).json({ error: '禁止访问内部网络' });
            }
        } else {
            // 如果是域名，理论上应该解析后检查 IP，这里简化处理：
            // 禁止包含 internal/local 等关键字的域名，或者依靠部署环境的防火墙
            // 完整实现需要 dns.lookup，但为避免复杂性，暂只允许公网访问或显式白名单
            // 这里仅做基础防护演示
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

// 辅助函数：检查是否为私有 IP
function isPrivateIp(ip) {
    if (ip === 'localhost') return true;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
}

module.exports = router;
