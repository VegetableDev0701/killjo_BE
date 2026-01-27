'use strict';

const merchantController = require('../../controllers/merchantController');
const { Merchant } = require('..');

module.exports = {
  async up (queryInterface, Sequelize) {
    try {
      // Get all existing merchants
      const merchants = await Merchant.findAll();
      console.log(`Found ${merchants.length} merchants. Generating QR codes...`);

      // Generate QR codes for each merchant
      for (const merchant of merchants) {
        try {
          if (merchant.qr_code_url) {
            continue; // Skip if QR code already exists
          }
          // Set the share URL before generating QR code
          await merchantController.generateAndSaveQRCode(merchant);
          console.log(`Generated QR code for merchant: ${merchant.slug}`);
        } catch (error) {
          console.error(`Failed to generate QR code for merchant ${merchant.slug}:`, error);
          // Continue with next merchant even if one fails
        }
      }

      console.log('Finished generating QR codes for existing merchants');
    } catch (error) {
      console.error('Error while generating QR codes:', error);
      // Don't throw the error - the column has been added successfully
      // QR codes can be regenerated later if needed
    }
  },

  async down (queryInterface, Sequelize) {
  }
};
