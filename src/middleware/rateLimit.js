const rateLimit = require('express-rate-limit');

// 基础速率限制（所有请求）
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 登录接口速率限制（更严格）
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: { error: '登录尝试次数过多，请15分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 注册接口速率限制
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3,
    message: { error: '注册次数过多，请1小时后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    generalLimiter,
    loginLimiter,
    registerLimiter
};
