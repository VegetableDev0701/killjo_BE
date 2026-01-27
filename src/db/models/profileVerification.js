const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ProfileVerification extends Model {
        static associate(models) {
            ProfileVerification.belongsTo(models.User, { foreignKey: 'userId' });
        }
    }

    ProfileVerification.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
            },
            appleIdName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            cedulaFrontImageUrl: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            brandName: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            category: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM('UNDER_REVIEW', 'VERIFIED', 'REJECTED'),
                allowNull: false,
                defaultValue: 'UNDER_REVIEW',
            },
            rejectionReason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'ProfileVerification',
            tableName: 'profile_verifications',
            timestamps: true,
        }
    );

    return ProfileVerification;
};