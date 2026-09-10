require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. Kết nối tới MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('Đã kết nối thành công tới MongoDB Atlas!'))
    .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// 2. Định nghĩa Schema (Cấu trúc dữ liệu)
const textSchema = new mongoose.Schema({
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const TextModel = mongoose.model('TextLog', textSchema);

// 3. API Endpoint: POST /append (Lưu chuỗi vào Database)
app.post('/append', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số "text"' });
        }

        // Lưu bản ghi mới vào MongoDB
        const newLog = new TextModel({ content: text });
        await newLog.save();

        res.json({
            success: true,
            message: 'Đã lưu chuỗi vào Database thành công!',
            data: newLog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 4. API Endpoint: GET /read (Đọc danh sách chuỗi đã lưu)
app.get('/read', async (req, res) => {
    try {
        // Lấy tất cả bản ghi, sắp xếp theo thời gian tạo mới nhất
        const logs = await TextModel.find().sort({ createdAt: -1 });
        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});