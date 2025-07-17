const authMiddleware = async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authorization denied, no token provided' });
      }
  
      const token = authHeader.substring(7); // Remove 'Bearer ' from header
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user by ID and check if token matches active token
      const user = await User.findById(decoded.id);
      if (!user || user.activeToken !== token) {
        return res.status(401).json({ success: false, message: 'Token is invalid or expired' });
      }
      
      // Set user in request object
      req.user = {
        id: user._id,
        name: user.name,
        phone: user.phone,
        upiId: user.upiId,
        walletBalance: user.walletBalance
      };
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ success: false, message: 'Token is invalid' });
    }
  };