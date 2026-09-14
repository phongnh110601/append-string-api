require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. Tối ưu kết nối MongoDB Atlas cho Serverless Function
let isConnected = false;

const connectToDatabase = async () => {
    if (isConnected) {
        return;
    }

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI chưa được cấu hình trong biến môi trường!');
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            bufferCommands: false, // Tắt buffering để phát hiện lỗi ngay nếu chưa kết nối
        });
        isConnected = db.connections[0].readyState === 1;
        console.log('Đã kết nối thành công tới MongoDB Atlas!');
    } catch (err) {
        console.error('Lỗi kết nối MongoDB:', err);
        throw err;
    }
};

// Middleware đảm bảo luôn kết nối DB trước khi xử lý request
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Không thể kết nối đến cơ sở dữ liệu: ' + error.message
        });
    }
});

// 2. Định nghĩa Schema & Model
const textSchema = new mongoose.Schema({
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const TextModel = mongoose.models.TextLog || mongoose.model('TextLog', textSchema);

// 3. API Endpoint: POST /append (Lưu chuỗi vào Database)
app.post('/append', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số "text"' });
        }

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
        const logs = await TextModel.find().sort({ createdAt: -1 });
        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 5. API Endpoint mới: DELETE /delete-all (Xóa tất cả dữ liệu)
app.delete('/delete-all', async (req, res) => {
    try {
        const result = await DataModel.deleteMany({});
        res.json({
            success: true,
            message: 'Đã xóa toàn bộ dữ liệu thành công!',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 5. Chạy local dev server nếu không nằm trong môi trường Vercel (production)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export app để Vercel sử dụng làm Handler Function
module.exports = app;