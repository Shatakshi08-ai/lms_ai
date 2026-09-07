process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-chars-xxxx';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars-xxxx';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_ai_test';
process.env.AI_PROVIDER = 'mock';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
