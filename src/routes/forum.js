const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../db/database');

const router = express.Router();
const FORUM_FILE = path.join(__dirname, '../../data', 'forum.json');

// 读取论坛数据
function getForumData() {
    try {
        const data = fs.readFileSync(FORUM_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { posts: [], categories: ['讨论', '分享', '教程', '求助', '公告'] };
    }
}

// 保存论坛数据
function saveForumData(data) {
    fs.writeFileSync(FORUM_FILE, JSON.stringify(data, null, 2));
}

// 获取帖子列表
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 15, sort = 'latest', category } = req.query;
        const forumData = getForumData();
        let posts = [...forumData.posts];

        // 按分类筛选
        if (category && category !== 'all') {
            posts = posts.filter(p => p.category === category);
        }

        // 排序
        if (sort === 'latest') {
            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'hot') {
            posts.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
        } else if (sort === 'mostLiked') {
            posts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        }

        // 分页
        const total = posts.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const pagePosts = posts.slice(start, start + parseInt(limit));

        res.json({
            posts: pagePosts,
            totalPages,
            currentPage: parseInt(page),
            total,
            categories: forumData.categories
        });
    } catch (error) {
        console.error('获取帖子列表错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 搜索帖子
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ posts: [] });

        const forumData = getForumData();
        const keyword = q.toLowerCase();
        const posts = forumData.posts.filter(p =>
            p.title.toLowerCase().includes(keyword) ||
            p.content.toLowerCase().includes(keyword)
        );

        res.json({ posts });
    } catch (error) {
        console.error('搜索错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 发布帖子
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: '标题和内容不能为空' });
        }

        if (title.length > 100) {
            return res.status(400).json({ error: '标题不能超过100个字符' });
        }

        // 获取用户信息
        const db = await getDb();
        const user = await db.get('SELECT username, avatar FROM users WHERE id = ?', [req.user.id]);

        const forumData = getForumData();
        const newPost = {
            id: Date.now().toString(),
            title,
            content,
            category: category || '讨论',
            authorId: req.user.id,
            authorName: user?.username || req.user.username,
            authorAvatar: user?.avatar || '',
            createdAt: new Date().toISOString(),
            likes: [],
            comments: []
        };

        forumData.posts.unshift(newPost);
        saveForumData(forumData);

        res.json({ message: '发布成功', post: newPost });
    } catch (error) {
        console.error('发布帖子错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 获取单个帖子详情
router.get('/posts/:id', (req, res) => {
    try {
        const { id } = req.params;
        const forumData = getForumData();
        const postIndex = forumData.posts.findIndex(p => p.id === id);

        if (postIndex === -1) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        const post = forumData.posts[postIndex];

        // 增加浏览量
        if (!post.views) post.views = 0;
        post.views++;
        saveForumData(forumData);

        // 转换格式以匹配前端期望
        const responsePost = {
            ...post,
            likedBy: post.likes || [],  // 前端期望 likedBy 数组
            likes: (post.likes || []).length,  // 前端期望 likes 是数字
            comments: (post.comments || []).map(comment => ({
                ...comment,
                likes: (comment.likes || []).length  // 评论的 likes 也是数字
            }))
        };

        res.json({ post: responsePost });
    } catch (error) {
        console.error('获取帖子详情错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 点赞帖子
router.post('/posts/:id/like', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const forumData = getForumData();
        const postIndex = forumData.posts.findIndex(p => p.id === id);

        if (postIndex === -1) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        const post = forumData.posts[postIndex];
        if (!post.likes) post.likes = [];

        const likeIndex = post.likes.indexOf(req.user.id);
        if (likeIndex === -1) {
            post.likes.push(req.user.id);
        } else {
            post.likes.splice(likeIndex, 1);
        }

        saveForumData(forumData);
        res.json({ liked: likeIndex === -1, likes: post.likes.length });
    } catch (error) {
        console.error('点赞错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除帖子
router.delete('/posts/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const forumData = getForumData();
        const postIndex = forumData.posts.findIndex(p => p.id === id);

        if (postIndex === -1) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        if (forumData.posts[postIndex].authorId !== req.user.id) {
            return res.status(403).json({ error: '无权删除此帖子' });
        }

        forumData.posts.splice(postIndex, 1);
        saveForumData(forumData);

        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除帖子错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 添加评论
router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: '评论内容不能为空' });
        }

        const db = await getDb();
        const user = await db.get('SELECT username, avatar FROM users WHERE id = ?', [req.user.id]);

        const forumData = getForumData();
        const post = forumData.posts.find(p => p.id === id);

        if (!post) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        if (!post.comments) post.comments = [];

        const newComment = {
            id: Date.now().toString(),
            content,
            authorId: req.user.id,
            authorName: user?.username || req.user.username,
            authorAvatar: user?.avatar || '',
            createdAt: new Date().toISOString(),
            likes: []
        };

        post.comments.push(newComment);
        saveForumData(forumData);

        res.json({ message: '评论成功', comment: newComment });
    } catch (error) {
        console.error('评论错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 点赞评论
router.post('/posts/:postId/comments/:commentId/like', authenticateToken, (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const forumData = getForumData();
        const post = forumData.posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        const comment = post.comments?.find(c => c.id === commentId);
        if (!comment) {
            return res.status(404).json({ error: '评论不存在' });
        }

        if (!comment.likes) comment.likes = [];

        const likeIndex = comment.likes.indexOf(req.user.id);
        if (likeIndex === -1) {
            comment.likes.push(req.user.id);
        } else {
            comment.likes.splice(likeIndex, 1);
        }

        saveForumData(forumData);
        res.json({ liked: likeIndex === -1, likes: comment.likes.length });
    } catch (error) {
        console.error('评论点赞错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除评论
router.delete('/posts/:postId/comments/:commentId', authenticateToken, (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const forumData = getForumData();
        const post = forumData.posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        const commentIndex = post.comments?.findIndex(c => c.id === commentId);
        if (commentIndex === -1) {
            return res.status(404).json({ error: '评论不存在' });
        }

        if (post.comments[commentIndex].authorId !== req.user.id) {
            return res.status(403).json({ error: '无权删除此评论' });
        }

        post.comments.splice(commentIndex, 1);
        saveForumData(forumData);

        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除评论错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
