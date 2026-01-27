const { Pool } = require('pg');
const ScrappedDataColumns = {
  vehicles: ["hid", "brand", "model", "year", "engine", "condition", "mileage_value", "mileage_unit", "exterior_color", "interior_color", "passengers", "fuel_type", "transmission", "traction", "price_value as price", "price_currency", "location", "city", "province", "coordinates", "images_url", "detail_url", "accessories", "source", "created_at", "updated_at"],
  real_estate: ["hid", "title", "price_usd as price", "listing_type", "bedrooms", "bathrooms", "area", "location", "coordinates", "description", "features", "images_url", "detail_url", "source", "updated_at"],
  products: ["hid", "title", "category", "brand", "price_value as price", "price_currency", "availability", "images_url", "detail_url", "location", "coordinates", "source", "created_at", "updated_at"]
};

class ScrappedDataService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.LISTING_URL,
      ssl: false,
    });
  }

  async getScrappedDataByUserId(userId, status = null) {
    let statusFilter = status ? `AND (is_dead IS NULL OR is_dead = ${status === 'active' ? false : true})` : '';
    // Filter out hidden/dead items
    const vehicleQuery = this.pool.query(`SELECT ${ScrappedDataColumns.vehicles.join(", ")} FROM vehicles_color_v1 WHERE user_id = $1 ${statusFilter}`, [userId]);
    const productQuery = this.pool.query(`SELECT ${ScrappedDataColumns.products.join(", ")} FROM products_clean WHERE user_id = $1 ${statusFilter}`, [userId]);
    const realEstateQuery = this.pool.query(`SELECT ${ScrappedDataColumns.real_estate.join(", ")} FROM real_estate_v2 WHERE user_id = $1 ${statusFilter}`, [userId]);
    const [vehicle, product, realEstate] = await Promise.all([vehicleQuery, productQuery, realEstateQuery]);

    let data = [
      ...vehicle.rows.map(row => ({ ...row, category: 'vehicles' })),
      ...product.rows,
      ...realEstate.rows.map(row => ({ ...row, category: 'real_estate' }))
    ];

    return data;
  }

  async getScrappedDataByProductIds(productIds) {
    if (!productIds || productIds.length === 0) return [];

    // Create placeholders like $1, $2, ... for the IN clause
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');

    const vehicleQuery = this.pool.query(
      `SELECT ${ScrappedDataColumns.vehicles.join(", ")} FROM vehicles_color_v1 WHERE hid IN (${placeholders})`,
      productIds
    );
    const productQuery = this.pool.query(
      `SELECT ${ScrappedDataColumns.products.join(", ")} FROM products_clean WHERE hid IN (${placeholders})`,
      productIds
    );
    const realEstateQuery = this.pool.query(
      `SELECT ${ScrappedDataColumns.real_estate.join(", ")} FROM real_estate_v2 WHERE hid IN (${placeholders})`,
      productIds
    );

    const [vehicle, product, realEstate] = await Promise.all([vehicleQuery, productQuery, realEstateQuery]);

    let data = [
      ...vehicle.rows.map(row => ({ ...row, category: 'vehicles' })),
      ...product.rows, // products_clean usually has 'category' column already
      ...realEstate.rows.map(row => ({ ...row, category: 'real_estate' }))
    ];

    return data;
  }

  async getUserIdScrappedCountMap(userIds, status = null) {
    let statusFilter = status ? `AND (is_dead IS NULL OR is_dead = ${status === 'active' ? false : true})` : '';

    const sqlQuery = `
     SELECT user_id, COUNT(*) as count
      FROM (
        SELECT user_id FROM vehicles_color_v1 WHERE user_id = ANY($1) ${statusFilter}
        UNION ALL
        SELECT user_id FROM products_clean WHERE user_id = ANY($1) ${statusFilter}
        UNION ALL
        SELECT user_id FROM real_estate_v2 WHERE user_id = ANY($1) ${statusFilter}
      ) AS combined
      GROUP BY user_id
    `;
    const res = await this.pool.query(sqlQuery, [userIds]);
    const userIdCountMap = {};
    res.rows.forEach(row => {
      userIdCountMap[row.user_id] = parseInt(row.count);
    });

    return userIdCountMap;
  }

  async hideScrappedDataByUserId(userId) {
    try {
      const queries = [
        this.pool.query('UPDATE vehicles_color_v1 SET is_dead = true WHERE user_id = $1', [userId]),
        this.pool.query('UPDATE products_clean SET is_dead = true WHERE user_id = $1', [userId]),
        this.pool.query('UPDATE real_estate_v2 SET is_dead = true WHERE user_id = $1', [userId])
      ];

      const results = await Promise.all(queries);
      const totalHidden = results.reduce((sum, result) => sum + result.rowCount, 0);

      console.log(`Hidden ${totalHidden} scrapped products for user ${userId}`);
      return { hidden: totalHidden };
    } catch (error) {
      console.error('Error hiding scrapped data:', error);
      throw error;
    }
  }

  async showScrappedDataByUserId(userId) {
    try {
      const queries = [
        this.pool.query('UPDATE vehicles_color_v1 SET is_dead = false WHERE user_id = $1', [userId]),
        this.pool.query('UPDATE products_clean SET is_dead = false WHERE user_id = $1', [userId]),
        this.pool.query('UPDATE real_estate_v2 SET is_dead = false WHERE user_id = $1', [userId])
      ];

      const results = await Promise.all(queries);
      const totalRestored = results.reduce((sum, result) => sum + result.rowCount, 0);

      console.log(`Restored ${totalRestored} scrapped products for user ${userId}`);
      return { restored: totalRestored };
    } catch (error) {
      console.error('Error showing scrapped data:', error);
      throw error;
    }
  }
}

module.exports = new ScrappedDataService();