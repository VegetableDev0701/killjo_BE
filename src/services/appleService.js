const {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  ReceiptUtility,
} = require("@apple/app-store-server-library");
const fs = require("fs");
const path = require("path");
const { loadAppleRootCertificates } = require("../config/apple-certificates");

class AppleService {
  constructor() {
    this.initializeClients();
  }

  initializeClients() {
    let encodedKey;

    // Option 1: Use APPLE_PRIVATE_KEY environment variable (for deployed environments)
    if (process.env.APPLE_PRIVATE_KEY) {
      encodedKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
      console.log(
        "Using Apple private key from APPLE_PRIVATE_KEY environment variable"
      );
    }
    // Option 2: Read from file (for local development)
    else {
      const keyPath = path.join(
        __dirname,
        "../../certificates/SubscriptionKey_" + process.env.APPLE_KEY_ID + ".p8"
      );
      if (fs.existsSync(keyPath)) {
        encodedKey = fs.readFileSync(keyPath, "utf8");
        console.log("Using Apple private key from file:", keyPath);
      } else {
        throw new Error(
          `Apple private key not found. Set APPLE_PRIVATE_KEY environment variable or place file at: ${keyPath}`
        );
      }
    }

    const environment =
      process.env.APPLE_ENVIRONMENT === "PRODUCTION"
        ? Environment.PRODUCTION
        : Environment.SANDBOX;
    console.log("APPLE environment is:", process.env.APPLE_ENVIRONMENT, environment);


    // Initialize API Client
    this.apiClient = new AppStoreServerAPIClient(
      encodedKey,
      process.env.APPLE_KEY_ID,
      process.env.APPLE_ISSUER_ID,
      process.env.APPLE_BUNDLE_ID,
      environment
    );

    // Initialize Verifier
    const appleRootCAs = loadAppleRootCertificates();
    const appAppleId =
      environment === Environment.PRODUCTION
        ? parseInt(process.env.APPLE_APP_ID)
        : undefined;

    this.verifier = new SignedDataVerifier(
      appleRootCAs,
      true, // enableOnlineChecks
      environment,
      process.env.APPLE_BUNDLE_ID,
      appAppleId
    );

    // Initialize Receipt Utility
    this.receiptUtility = new ReceiptUtility();
  }

  // Extract transaction ID from receipt
  extractTransactionIdFromReceipt(appReceipt) {
    try {
      return this.receiptUtility.extractTransactionIdFromAppReceipt(appReceipt);
    } catch (error) {
      console.error("Failed to extract transaction ID from receipt:", error);
      throw new Error("Invalid receipt format");
    }
  }

  // Get transaction info from Apple
  async getTransactionInfo(transactionId) {
    try {
      const response = await this.apiClient.getTransactionInfo(transactionId);

      if (!response.signedTransactionInfo) {
        throw new Error("No signed transaction info received");
      }

      // Verify and decode the signed transaction
      const decodedTransaction = await this.verifier.verifyAndDecodeTransaction(
        response.signedTransactionInfo
      );

      return decodedTransaction;
    } catch (error) {
      console.error("Failed to get transaction info:", error);
      throw new Error("Failed to validate transaction with Apple");
    }
  }

  // Get transaction history for a subscription
  async getTransactionHistory(originalTransactionId) {
    try {
      const response = await this.apiClient.getTransactionHistory(
        originalTransactionId,
        null, // revision token
        {
          sort: "ASCENDING",
          productTypes: ["AUTO_RENEWABLE"],
          revoked: false,
        }
      );

      const transactions = [];

      if (response.signedTransactions) {
        for (const signedTransaction of response.signedTransactions) {
          const decodedTransaction =
            await this.verifier.verifyAndDecodeTransaction(signedTransaction);
          transactions.push(decodedTransaction);
        }
      }

      return transactions;
    } catch (error) {
      console.error("Failed to get transaction history:", error);
      throw new Error("Failed to get subscription history");
    }
  }

  // Verify and decode notification (for webhooks)
  async verifyNotification(signedPayload) {
    try {
      return await this.verifier.verifyAndDecodeNotification(signedPayload);
    } catch (error) {
      console.error("Failed to verify notification:", error);
      throw new Error("Invalid notification signature");
    }
  }

  // send test notification
  async sendTestNotification(notificationType = "SUBSCRIBED") {
    try {
      // Available notification types for testing:
      // SUBSCRIBED, DID_RENEW, EXPIRED, DID_FAIL_TO_RENEW,
      // DID_CHANGE_RENEWAL_STATUS, PRICE_INCREASE, REFUND, etc.

      console.log(`Sending test notification of type: ${notificationType}`);

      const response = await this.apiClient.requestTestNotification();

      console.log("Test notification sent successfully:", response);

      return {
        success: true,
        testNotificationToken: response.testNotificationToken,
        message: `Test notification of type ${notificationType} sent successfully`,
      };
    } catch (error) {
      console.error("Failed to send test notification:", error);
      throw new Error(`Failed to send test notification: ${error.message}`);
    }
  }
}

module.exports = AppleService;
