const { User } = require('../db');

class AnalyticsAccessController {

    async getPendingAccessUsers(req, res) {
        try {
          const pendingUsers = await User.findAll({
            attributes: ['id', 'full_name', 'analytics_access_status', 'analytics_access_expire']
          });

          res.json({
                success: true,
                data: pendingUsers
            });

        } catch (error) {
            console.error('Error getting pending analytics access users:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async approveUser(req, res) {
        try {
          const { id } = req.query;
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now
          

          const resultPending = await User.update(
            { analyticsAccessStatus: 'APPROVED',
              analyticsAccessExpire: expiryDate
             }, 
            { where: { id: id } }
          );


          res.json({
                success: true,
                data: resultPending
            });

        } catch (error) {
            console.error('Error getting pending analytics access users:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

}

module.exports = new AnalyticsAccessController();
