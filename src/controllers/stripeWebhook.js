const { Business, Subscription, Transaction, PromotionCredit } = require('../db');
const { handleStripeEvent } = require('../utils/stripeService');
const { subscriptionConfirmationEmail } = require('../utils/emailTemplates');
const { sendEmail } = require('../utils/emailService');
const { updatePlanLimits, resetMonthlyCredits } = require('../utils/planLimitService');

/**
 * Handle Stripe webhook events
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Process the webhook event
    const event = await handleStripeEvent(req.body, signature);
    
    // Respond to Stripe immediately to prevent retries
    res.status(200).send();
    
    // Process different event types asynchronously
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Stripe webhook error:', error);
    // Still return 200 to avoid Stripe retrying the webhook
    return res.status(200).end();
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session) {
  try {
    const { businessId, planId } = session.metadata;
    
    if (!businessId || !planId) {
      console.error('Missing metadata in checkout session');
      return;
    }

    // Update plan limits for the business
    await updatePlanLimits(businessId, planId);
    
    // Find business
    const business = await Business.findByPk(businessId);
    
    if (business) {
      // Send welcome email for new subscriptions
      await sendEmail(business.email, subscriptionConfirmationEmail({
        businessName: business.name,
        planName: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        startDate: new Date().toLocaleDateString()
      }));
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(invoice) {
  try {
    // Get subscription ID
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      console.error('Missing subscription ID in invoice');
      return;
    }
    
    // Find subscription in our database
    const subscription = await Subscription.findOne({
      where: { stripeSubscriptionId: subscriptionId }
    });
    
    if (!subscription) {
      console.error(`Subscription not found: ${subscriptionId}`);
      return;
    }
    
    // Update subscription status if needed
    if (subscription.status !== 'active') {
      await subscription.update({ status: 'active' });
    }
    
    // Update current period end
    const periodEnd = new Date(invoice.lines.data[0]?.period.end * 1000);
    await subscription.update({ currentPeriodEnd: periodEnd });
    
    // Record transaction
    await Transaction.create({
      businessId: subscription.businessId,
      type: 'subscription_renewal',
      status: 'completed',
      amount: invoice.amount_paid,
      currency: invoice.currency,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent,
      metadata: {
        subscriptionId: subscription.id,
        planId: subscription.planId
      }
    });
    
    // Reset monthly credits if it's time
    const subscribedBusiness = await Business.findByPk(subscription.businessId);
    if (subscribedBusiness && subscribedBusiness.next_credits_reset && new Date() >= subscribedBusiness.next_credits_reset) {
      await resetMonthlyCredits(subscribedBusiness.id);
    }
    
    // Find business for email
    const businessForEmail = await Business.findByPk(subscription.businessId);
    
    // Send confirmation email
    if (businessForEmail) {
      await sendEmail(businessForEmail.email, subscriptionConfirmationEmail({
        businessName: businessForEmail.name,
        planName: `${subscription.planId.charAt(0).toUpperCase() + subscription.planId.slice(1)} Plan`,
        amount: (invoice.amount_paid / 100).toFixed(2),
        startDate: new Date().toLocaleDateString(),
        nextBillingDate: periodEnd.toLocaleDateString()
      }));
    }
  } catch (error) {
    console.error('Error handling invoice paid:', error);
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    // Get subscription ID
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      console.error('Missing subscription ID in invoice');
      return;
    }
    
    // Find subscription in our database
    const subscription = await Subscription.findOne({
      where: { stripeSubscriptionId: subscriptionId }
    });
    
    if (!subscription) {
      console.error(`Subscription not found: ${subscriptionId}`);
      return;
    }
    
    // Update subscription status
    await subscription.update({ status: 'past_due' });
    
    // Record transaction
    await Transaction.create({
      businessId: subscription.businessId,
      type: 'subscription_payment_failed',
      status: 'failed',
      amount: invoice.amount_due,
      currency: invoice.currency,
      stripeInvoiceId: invoice.id,
      metadata: {
        subscriptionId: subscription.id,
        planId: subscription.planId,
        attempt: invoice.attempt_count
      }
    });
    
    // TODO: Send payment failed email
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(stripeSubscription) {
  try {
    // Find subscription in our database
    const subscription = await Subscription.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id }
    });
    
    // If subscription doesn't exist yet, create it
    if (!subscription) {
      // Get business by Stripe customer ID
      const business = await Business.findOne({
        where: { stripeCustomerId: stripeSubscription.customer }
      });
      
      if (!business) {
        console.error(`Business not found for customer: ${stripeSubscription.customer}`);
        return;
      }
      
      // Create new subscription
      await Subscription.create({
        businessId: business.id,
        stripeSubscriptionId: stripeSubscription.id,
        planId: stripeSubscription.items.data[0]?.price.product,
        status: stripeSubscription.status,
        amount: stripeSubscription.items.data[0]?.price.unit_amount,
        currency: stripeSubscription.currency,
        interval: stripeSubscription.items.data[0]?.price.recurring.interval,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
      });
      
      // Update business subscription tier
      const planId = stripeSubscription.items.data[0]?.price.product;
      if (planId && stripeSubscription.status === 'active') {
        await business.update({ subscriptionTier: planId });
      }
    } else {
      // Update existing subscription
      await subscription.update({
        status: stripeSubscription.status,
        amount: stripeSubscription.items.data[0]?.price.unit_amount,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
      });
      
      // Update business subscription tier if needed
      if (stripeSubscription.status === 'active') {
        const business = await Business.findByPk(subscription.businessId);
        if (business) {
          await business.update({ subscriptionTier: subscription.planId });
        }
      }
    }

    // Update plan limits if plan changed
    const planId = stripeSubscription.items.data[0]?.price.product;
    if (planId && stripeSubscription.status === 'active') {
      const businessToUpdate = await Business.findOne({
        where: { stripeCustomerId: stripeSubscription.customer }
      });
      
      if (businessToUpdate) {
        await updatePlanLimits(businessToUpdate.id, planId);
      }
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(stripeSubscription) {
  try {
    // Find subscription in our database
    const subscription = await Subscription.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id }
    });
    
    if (!subscription) {
      console.error(`Subscription not found: ${stripeSubscription.id}`);
      return;
    }
    
    // Update subscription status
    await subscription.update({
      status: 'cancelled',
      cancelledAt: new Date()
    });
    
    // Update business tier to free
    const business = await Business.findByPk(subscription.businessId);
    if (business) {
      await business.update({ subscriptionTier: 'free' });
    }

    // Reset to free plan limits
    const businessToReset = await Business.findOne({
      where: { stripeCustomerId: stripeSubscription.customer }
    });
    
    if (businessToReset) {
      await updatePlanLimits(businessToReset.id, 'free');
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle promotion credit purchase
 */
async function handlePromotionCreditPurchase(session, business) {
  try {
    // Get credit package and quantity from session
    const { creditPackage, quantity = 1 } = session.metadata || {};
    
    if (!creditPackage) {
      console.error('Missing credit package in session metadata');
      return;
    }
    
    let creditAmount = 0;
    
    // Determine credit amount based on package
    if (creditPackage === 'single_credit') {
      creditAmount = 1 * parseInt(quantity, 10);
    } else if (creditPackage === 'credit_pack_5') {
      creditAmount = 5 * parseInt(quantity, 10);
    } else if (creditPackage === 'credit_pack_10') {
      creditAmount = 10 * parseInt(quantity, 10);
    } else {
      console.error(`Unknown credit package: ${creditPackage}`);
      return;
    }
    
    // Update business credit balance
    const currentBalance = business.promotionCreditBalance || 0;
    await business.update({
      promotionCreditBalance: currentBalance + creditAmount
    });
    
    // Create promotion credit record
    await PromotionCredit.create({
      businessId: business.id,
      type: 'purchased',
      amount: creditAmount,
      status: 'completed',
      metadata: {
        packageId: creditPackage,
        quantity,
        checkoutSessionId: session.id,
        previousBalance: currentBalance,
        newBalance: currentBalance + creditAmount
      }
    });
    
    // Record transaction
    await Transaction.create({
      businessId: business.id,
      type: 'promotion_credit_purchase',
      status: 'completed',
      amount: session.amount_total,
      currency: session.currency,
      stripePaymentIntentId: session.payment_intent,
      metadata: {
        creditPackage,
        creditAmount,
        quantity
      }
    });
    
    // TODO: Send confirmation email
  } catch (error) {
    console.error('Error handling promotion credit purchase:', error);
  }
}

module.exports = {
  handleWebhook
}; 