const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Merchant = sequelize.define('Merchant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    brand_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    logo_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    share_url: {
      type: DataTypes.VIRTUAL,
      get() {
        return `https://www.nodoia.app/m/${this.slug}`;
      },
    },
    qr_code_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    boost: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    boost_expire: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'merchant',
    timestamps: true,
  });

  Merchant.beforeValidate(async (merchant) => {
    if (!merchant.slug && merchant.brand_name) {
      let baseSlug = merchant.brand_name
        .toLowerCase()
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let slug = baseSlug;
      let counter = 1;

      const existing = await Merchant.findOne({ where: { slug } });
      while (existing) {
        slug = `${baseSlug}-${counter++}`;
        const conflict = await Merchant.findOne({ where: { slug } });
        if (!conflict) break;
      }

      merchant.slug = slug;
    }
  });

  return Merchant;
};
