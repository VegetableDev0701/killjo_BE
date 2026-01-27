const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

// Subscription plan configurations
const plans = {
  free: {
    name: 'Free Plan',
    amount: 0,
    features: {
      listingLimit: 3,
      includesAnalytics: false,
      monthlyHighlightQuota: 3,
      promoCreditsDiscount: 0,
      patchColor: 'grey',
      displayPriority: 1,
    },
  },
  smart: {
    name: 'Smart Plan',
    amount: 2900, // $29.00
    stripePriceId: process.env.STRIPE_SMART_PRICE_ID,
    features: {
      listingLimit: null, // unlimited
      includesAnalytics: true,
      monthlyHighlightQuota: 10,
      promoCreditsDiscount: 0,
      patchColor: 'blue',
      displayPriority: 2,
    },
  },
  pro: {
    name: 'Pro Plan',
    amount: 7900, // $79.00
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      listingLimit: null, // unlimited
      includesAnalytics: true,
      monthlyHighlightQuota: 30,
      promoCreditsDiscount: 50, // 50% discount
      patchColor: 'gold',
      displayPriority: 3,
    },
  },
};

// Promo credit pricing
const creditPricing = {
  singleCredit: {
    name: '1 Promo Credit',
    description: 'Highlight 1 listing for 3 days',
    amount: 300, // $3.00 per credit
    stripePriceId: process.env.STRIPE_SINGLE_CREDIT_PRICE_ID,
    creditAmount: 1,
  },
  bulkCredits: {
    name: '10 Promo Credits',
    description: 'Highlight 10 listings for 3 days each',
    amount: 2500, // $25.00 for 10 credits
    stripePriceId: process.env.STRIPE_BULK_CREDIT_PRICE_ID,
    creditAmount: 10,
  },
};

// Create a Stripe customer
const createCustomer = async (businessData) => {
  try {
    const customer = await stripe.customers.create({
      email: businessData.email,
      name: businessData.name,
      metadata: {
        businessId: businessData.id,
      },
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Create a subscription
const createSubscription = async (customerId, priceId, businessId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        { price: priceId },
      ],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        businessId,
      },
    });
    
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Create a checkout session for subscription
const createSubscriptionCheckout = async (customerId, priceId, businessId, successUrl, cancelUrl) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        businessId,
      },
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Create a checkout session for promo credits
const createCreditsCheckout = async (customerId, priceId, businessId, successUrl, cancelUrl, applyDiscount = false) => {
  try {
    let unitAmount;
    const creditProduct = Object.values(creditPricing).find(product => product.stripePriceId === priceId);
    
    if (!creditProduct) {
      throw new Error('Invalid price ID');
    }
    
    // Apply discount for Pro users if applicable
    if (applyDiscount) {
      unitAmount = Math.round(creditProduct.amount * 0.5); // 50% discount
    } else {
      unitAmount = creditProduct.amount;
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: creditProduct.name,
              description: creditProduct.description,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        businessId,
        creditAmount: creditProduct.creditAmount.toString(),
        productType: 'promo_credits',
        discountApplied: applyDiscount ? 'true' : 'false',
      },
    });
    
    return session;
  } catch (error) {
    console.error('Error creating credits checkout session:', error);
    throw error;
  }
};

// Cancel a subscription
const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Reactivate a subscription that was set to cancel
const reactivateSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    
    return subscription;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
};

// Change subscription plan
const changeSubscriptionPlan = async (subscriptionId, newPriceId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get the first subscription item ID
    const itemId = subscription.items.data[0].id;
    
    // Update the subscription item with the new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: itemId,
        price: newPriceId,
      }],
    });
    
    return updatedSubscription;
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    throw error;
  }
};

// Process webhook event
const processWebhookEvent = async (event) => {
  let subscription;
  let invoice;
  let session;
  
  switch (event.type) {
    case 'customer.subscription.created':
      subscription = event.data.object;
      return {
        eventType: 'subscription_created',
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        planId: subscription.items.data[0].price.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        businessId: subscription.metadata.businessId,
      };
    
    case 'customer.subscription.updated':
      subscription = event.data.object;
      return {
        eventType: 'subscription_updated',
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        planId: subscription.items.data[0].price.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        businessId: subscription.metadata.businessId,
      };
    
    case 'customer.subscription.deleted':
      subscription = event.data.object;
      return {
        eventType: 'subscription_deleted',
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        businessId: subscription.metadata.businessId,
      };
    
    case 'invoice.payment_succeeded':
      invoice = event.data.object;
      return {
        eventType: 'payment_succeeded',
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_paid,
        subscriptionId: invoice.subscription,
        businessId: invoice.metadata?.businessId || invoice.subscription_details?.metadata?.businessId,
      };
    
    case 'invoice.payment_failed':
      invoice = event.data.object;
      return {
        eventType: 'payment_failed',
        invoiceId: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_due,
        subscriptionId: invoice.subscription,
        businessId: invoice.metadata?.businessId || invoice.subscription_details?.metadata?.businessId,
      };
    
    case 'checkout.session.completed':
      session = event.data.object;
      // Check if this is a subscription or one-time payment
      if (session.mode === 'subscription') {
        return {
          eventType: 'checkout_subscription_completed',
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          businessId: session.metadata.businessId,
        };
      } else if (session.metadata?.productType === 'promo_credits') {
        return {
          eventType: 'checkout_credits_completed',
          sessionId: session.id,
          customerId: session.customer,
          amount: session.amount_total,
          creditAmount: parseInt(session.metadata.creditAmount, 10),
          discountApplied: session.metadata.discountApplied === 'true',
          businessId: session.metadata.businessId,
        };
      }
      break;
    
    default:
      return { eventType: 'unknown', event: event.type };
  }
};

module.exports = {
  plans,
  creditPricing,
  createCustomer,
  createSubscription,
  createSubscriptionCheckout,
  createCreditsCheckout,
  cancelSubscription,
  reactivateSubscription,
  changeSubscriptionPlan,
  processWebhookEvent,
}; 