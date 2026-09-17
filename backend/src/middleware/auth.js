const jwt = require('jsonwebtoken');
const config = require('../config');

/** Gắn req.user từ JWT (nếu có). 401 khi thiếu/hết hạn token ở route yêu cầu đăng nhập. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập (thiếu token)' });
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

/** Yêu cầu người dùng có một trong các vai trò (mã role: DON_VI, VAN_PHONG_CUC, LANH_DAO_CUC, QMS, NHA_THAU) */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Không có quyền — yêu cầu vai trò: ${roles.join(', ')}` });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
