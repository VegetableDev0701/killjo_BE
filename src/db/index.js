'use strict';

const { Sequelize } = require('sequelize');
const process = require('process');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/sequelize')[env];

// Import User-related models
const UserModel = require('./models/user');
const AdminModel = require('./models/admin');
const ConversationModel = require('./models/conversation');
const MessageModel = require('./models/message');
const ConversationHistoryModel = require('./models/conversationHistory');
const FeedbackModel = require('./models/feedback');
const ClickConversionModel = require('../analytics/models/clickConversion');
const AnalyticsModel = require('../analytics/models/analytics');
const SearchQueryAnalyticsModel = require('../analytics/models/searchQuery');

// Import Article-related models
const ArticleModel = require('./models/article');
const ArticleViewModel = require('./models/articleView');
const ArticleLikeModel = require('./models/articleLike');

// Initialize Sequelize with unified configuration
let sequelize;
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    ...config,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl : false
    }
  });
} 

// Initialize User-related models with sequelize instance
const User = UserModel(sequelize);
const Admin = AdminModel(sequelize);
const Conversation = ConversationModel(sequelize);
const Message = MessageModel(sequelize);
const ConversationHistory = ConversationHistoryModel(sequelize);
const Feedback = FeedbackModel(sequelize);


// Initialize Payment-related models with sequelize instance
const Subscription = require('./models/subscription')(sequelize);
const UserFeature = require('./models/UserFeature')(sequelize);

// Import and initialize ProfileVerification model
const ProfileVerification = require('./models/profileVerification')(sequelize);

// Initialize Analytics related models with sequelize instance
const Analytics = AnalyticsModel(sequelize);
const ClickConversion = ClickConversionModel(sequelize);
const SearchQueryAnalytics = SearchQueryAnalyticsModel(sequelize);

// Initialize TopMerchant model with sequelize instance
const Merchant = require('./models/Merchant')(sequelize);

// Initialize Article-related models with sequelize instance
const Article = ArticleModel(sequelize);
const ArticleView = ArticleViewModel(sequelize);
const ArticleLike = ArticleLikeModel(sequelize);


// Set up model associations for User models
User.hasMany(Conversation, { foreignKey: 'userId' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

// Set up associations for Feedback
User.hasMany(Feedback, { foreignKey: 'user_id' });
Feedback.belongsTo(User, { foreignKey: 'user_id' });

Conversation.hasMany(Message, { foreignKey: 'conversationId' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });


// Set up associations for Payment models
User.hasMany(Subscription, { foreignKey: 'userId', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Subscription.hasMany(UserFeature, { foreignKey: 'subscriptionId', as: 'features' });
UserFeature.belongsTo(Subscription, { foreignKey: 'subscriptionId', as: 'subscription' });

// Set up associations for ProfileVerification
User.hasOne(ProfileVerification, { foreignKey: 'userId', as: 'profileVerification' });
// (belongsTo already set in model)

// Set up associations for Merchant models
User.hasOne(Merchant, { foreignKey: 'user_id', as: 'merchant' });
Merchant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Set up associations for Article models
User.hasMany(ArticleView, { foreignKey: 'userId', as: 'articleViews' });
ArticleView.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ArticleLike, { foreignKey: 'userId', as: 'articleLikes' });
ArticleLike.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Article.hasMany(ArticleView, { foreignKey: 'articleId', as: 'views', onDelete: 'CASCADE' });
ArticleView.belongsTo(Article, { foreignKey: 'articleId', as: 'article' });
Article.hasMany(ArticleLike, { foreignKey: 'articleId', as: 'likes', onDelete: 'CASCADE' });
ArticleLike.belongsTo(Article, { foreignKey: 'articleId', as: 'article' });

// Set up associations for Business models

const allModels = {
  User,
  Admin,
  Conversation,
  Message,
  ConversationHistory,
  Subscription,
  UserFeature,
  Feedback,
  ProfileVerification,
  Analytics,
  ClickConversion,
  SearchQueryAnalytics,
  Merchant,
  Article,
  ArticleView,
  ArticleLike,
};

Object.values(allModels).forEach(model => {
  if (model.associate) {
    model.associate(allModels);
  }
});


const initializeDatabase = async () => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // All Database sync or modifications must be done through migrations

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};


// Export database interface
module.exports = {
  sequelize,
  User,
  Admin,
  Conversation,
  Message,
  ConversationHistory,
  Subscription,
  UserFeature,
  Feedback,
  ProfileVerification,
  Analytics,
  ClickConversion,
  SearchQueryAnalytics,
  Merchant,
  Article,
  ArticleView,
  ArticleLike,
  initializeDatabase,
};
