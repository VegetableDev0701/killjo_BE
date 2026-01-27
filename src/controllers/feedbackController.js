const {Feedback} = require('../db');

// Feedback controller
class FeedbackController {
    async createFeedback(req, res) {
        try {
            const { rating, comment } = req.body;
            const user_id = req.user.id;
            if (!rating) {
                return res.status(400).json({ error: 'Rating is required' });
            }
            const feedback = await Feedback.create({ user_id, rating, comment });
            res.status(201).json(feedback);
        } catch (error) {
            console.error('Error creating feedback:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getFeedback(req, res) {
        try {
            const feedback = await Feedback.findAll();
            res.status(200).json(feedback);
        } catch (error) {
            console.error('Error fetching feedback:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new FeedbackController();
