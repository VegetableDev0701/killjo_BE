/**
 * Email templates for business authentication
 */

// Business verification email
const businessVerificationEmail = ({ ownerName, businessName, verificationToken }) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-business?token=${verificationToken}`;
  
  return {
    subject: `Verify Your Business Account - ${businessName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Our Platform!</h2>
        <p>Dear ${ownerName},</p>
        <p>Thank you for registering <strong>${businessName}</strong> on our platform. We're excited to have you join our community of businesses!</p>
        <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Your Account
          </a>
        </div>
        <p>This verification link will expire in 24 hours for security reasons.</p>
        <p>If you can't click the button, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>If you didn't create this account, please ignore this email or contact our support team.</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message, please do not reply to this email. If you need assistance, 
          please contact our support team.
        </p>
      </div>
    `,
    text: `
Welcome to Our Platform!

Dear ${ownerName},

Thank you for registering ${businessName} on our platform. We're excited to have you join our community of businesses!

To complete your registration and activate your account, please verify your email address by visiting this link:

${verificationUrl}

This verification link will expire in 24 hours for security reasons.

If you didn't create this account, please ignore this email or contact our support team.

This is an automated message, please do not reply to this email. If you need assistance, please contact our support team.
    `
  };
};

// Welcome email after verification
const welcomeEmail = (businessName) => {
  return {
    subject: 'Welcome to Our Platform!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Our Platform</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4a6cf7;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .feature {
            margin: 15px 0;
          }
          .feature h3 {
            margin-bottom: 5px;
            color: #4a6cf7;
          }
          .button {
            display: inline-block;
            background-color: #4a6cf7;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome Aboard!</h1>
          </div>
          <div class="content">
            <p>Hello ${businessName},</p>
            <p>Your business account has been successfully verified. Welcome to our platform!</p>
            
            <p>Here's what you can do now:</p>
            
            <div class="feature">
              <h3>📋 Add Your Listings</h3>
              <p>Start adding products or services to showcase to potential customers.</p>
            </div>
            
            <div class="feature">
              <h3>📊 Access Analytics</h3>
              <p>Track performance metrics to optimize your business presence.</p>
            </div>
            
            <div class="feature">
              <h3>👥 Invite Team Members</h3>
              <p>Add team members to help manage your business profile.</p>
            </div>
            
            <div class="feature">
              <h3>⭐ Explore Subscription Plans</h3>
              <p>Upgrade to Smart or Pro plans for enhanced visibility and features.</p>
            </div>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://ourplatform.com'}/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${businessName},
      
      Your business account has been successfully verified. Welcome to our platform!
      
      Here's what you can do now:
      
      📋 Add Your Listings
      Start adding products or services to showcase to potential customers.
      
      📊 Access Analytics
      Track performance metrics to optimize your business presence.
      
      👥 Invite Team Members
      Add team members to help manage your business profile.
      
      ⭐ Explore Subscription Plans
      Upgrade to Smart or Pro plans for enhanced visibility and features.
      
      Visit your dashboard: ${process.env.FRONTEND_URL || 'https://ourplatform.com'}/dashboard
      
      If you have any questions, please contact our support team.
      
      © ${new Date().getFullYear()} Our Platform. All rights reserved.
    `,
  };
};

// Password reset email
const passwordResetEmail = (businessName, resetLink) => {
  return {
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4a6cf7;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .button {
            display: inline-block;
            background-color: #4a6cf7;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .warning {
            color: #e74c3c;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${businessName},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${resetLink}</p>
            <p class="warning">This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request a password reset, please ignore this email or contact our support team - your account is secure.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${businessName},
      
      We received a request to reset your password. Please visit the following link to set a new password:
      ${resetLink}
      
      This link will expire in 1 hour for security reasons.
      
      If you didn't request a password reset, please ignore this email or contact our support team - your account is secure.
      
      © ${new Date().getFullYear()} Our Platform. All rights reserved.
    `,
  };
};

// Team member invitation email
const teamInvitationEmail = (businessName, recipientName, inviterName, inviteLink, role) => {
  return {
    subject: `You've Been Invited to Join ${businessName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4a6cf7;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .role {
            font-weight: bold;
            color: #4a6cf7;
          }
          .button {
            display: inline-block;
            background-color: #4a6cf7;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You've Been Invited!</h1>
          </div>
          <div class="content">
            <p>Hello ${recipientName || 'there'},</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on our platform as a <span class="role">${role}</span>.</p>
            <p>As a team member, you'll be able to help manage the business account based on your assigned role.</p>
            <p style="text-align: center;">
              <a href="${inviteLink}" class="button">Accept Invitation</a>
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${inviteLink}</p>
            <p>This invitation link will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>If you believe this invitation was sent in error, please ignore this email.</p>
            <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${recipientName || 'there'},
      
      ${inviterName} has invited you to join ${businessName} on our platform as a ${role}.
      
      As a team member, you'll be able to help manage the business account based on your assigned role.
      
      Accept the invitation by visiting this link:
      ${inviteLink}
      
      This invitation link will expire in 7 days.
      
      If you believe this invitation was sent in error, please ignore this email.
      
      © ${new Date().getFullYear()} Our Platform. All rights reserved.
    `,
  };
};

// Login notification email
const loginNotificationEmail = (businessName, time, location, device) => {
  return {
    subject: 'New Login to Your Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Login Alert</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4a6cf7;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .login-details {
            background-color: #e8eaf6;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          .login-item {
            margin-bottom: 10px;
          }
          .login-label {
            font-weight: bold;
          }
          .button {
            display: inline-block;
            background-color: #e74c3c;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Login Alert</h1>
          </div>
          <div class="content">
            <p>Hello ${businessName},</p>
            <p>We detected a new login to your account with the following details:</p>
            
            <div class="login-details">
              <div class="login-item">
                <span class="login-label">Time:</span> ${time}
              </div>
              <div class="login-item">
                <span class="login-label">Location:</span> ${location || 'Unknown location'}
              </div>
              <div class="login-item">
                <span class="login-label">Device/Browser:</span> ${device || 'Unknown device'}
              </div>
            </div>
            
            <p>If this was you, no further action is required.</p>
            
            <p>If you don't recognize this login, your account may have been compromised:</p>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://ourplatform.com'}/reset-password" class="button">Secure My Account</a>
            </p>
          </div>
          <div class="footer">
            <p>This is an automated security notification. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${businessName},
      
      We detected a new login to your account with the following details:
      
      Time: ${time}
      Location: ${location || 'Unknown location'}
      Device/Browser: ${device || 'Unknown device'}
      
      If this was you, no further action is required.
      
      If you don't recognize this login, your account may have been compromised. Please visit ${process.env.FRONTEND_URL || 'https://ourplatform.com'}/reset-password to secure your account immediately.
      
      This is an automated security notification. Please do not reply to this email.
      
      © ${new Date().getFullYear()} Our Platform. All rights reserved.
    `,
  };
};

// Subscription confirmation email
const subscriptionConfirmationEmail = (businessName, planName, amount, startDate, endDate) => {
  return {
    subject: `Subscription Confirmed - ${planName} Plan`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4a6cf7;
            padding: 20px;
            text-align: center;
          }
          .header h1 {
            color: white;
            margin: 0;
          }
          .content {
            padding: 20px;
            background-color: #f9f9f9;
          }
          .plan-details {
            background-color: #e8eaf6;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          .plan-item {
            margin-bottom: 10px;
          }
          .plan-label {
            font-weight: bold;
          }
          .plan-name {
            color: #4a6cf7;
            font-weight: bold;
          }
          .button {
            display: inline-block;
            background-color: #4a6cf7;
            color: white;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hello ${businessName},</p>
            <p>Thank you for subscribing to our <span class="plan-name">${planName}</span> plan. Your subscription is now active.</p>
            
            <div class="plan-details">
              <div class="plan-item">
                <span class="plan-label">Plan:</span> ${planName}
              </div>
              <div class="plan-item">
                <span class="plan-label">Amount:</span> ${amount}
              </div>
              <div class="plan-item">
                <span class="plan-label">Start Date:</span> ${startDate}
              </div>
              <div class="plan-item">
                <span class="plan-label">Next Billing Date:</span> ${endDate}
              </div>
            </div>
            
            <p>With your new subscription, you can now enjoy the following benefits:</p>
            ${planName === 'Smart' ? `
              <ul>
                <li>Unlimited listings</li>
                <li>Full access to market analytics</li>
                <li>Blue patch indicating verified status</li>
              </ul>
            ` : planName === 'Pro' ? `
              <ul>
                <li>Unlimited listings</li>
                <li>Full access to market analytics</li>
                <li>Gold patch indicating premium status</li>
                <li>3 free listing highlights per month</li>
                <li>50% discount on additional promo credits</li>
                <li>Priority placement in search results</li>
              </ul>
            ` : ''}
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://ourplatform.com'}/dashboard" class="button">Go to Dashboard</a>
            </p>
            
            <p>If you have any questions about your subscription, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>You can manage your subscription from your account settings at any time.</p>
            <p>&copy; ${new Date().getFullYear()} Our Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${businessName},
      
      Thank you for subscribing to our ${planName} plan. Your subscription is now active.
      
      Plan: ${planName}
      Amount: ${amount}
      Start Date: ${startDate}
      Next Billing Date: ${endDate}
      
      With your new subscription, you can now enjoy the following benefits:
      ${planName === 'Smart' ? `
      - Unlimited listings
      - Full access to market analytics
      - Blue patch indicating verified status
      ` : planName === 'Pro' ? `
      - Unlimited listings
      - Full access to market analytics
      - Gold patch indicating premium status
      - 3 free listing highlights per month
      - 50% discount on additional promo credits
      - Priority placement in search results
      ` : ''}
      
      Go to your dashboard: ${process.env.FRONTEND_URL || 'https://ourplatform.com'}/dashboard
      
      If you have any questions about your subscription, please contact our support team.
      
      You can manage your subscription from your account settings at any time.
      
      © ${new Date().getFullYear()} Our Platform. All rights reserved.
    `,
  };
};

/**
 * Generate team member invitation email content
 * @param {Object} params Email parameters
 * @returns {Object} Email subject and body
 */
function teamMemberInvitationEmail({ businessName, teamMemberName, inviterName, role, invitationUrl }) {
  return {
    subject: `You've been invited to join ${businessName} team`,
    html: `
      <h2>Welcome to ${businessName}!</h2>
      <p>Hi ${teamMemberName},</p>
      <p>${inviterName} has invited you to join ${businessName} as a team member with the role of ${role}.</p>
      <p>To accept this invitation and set up your account, please click the button below:</p>
      <p>
        <a href="${invitationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          Accept Invitation
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p>${invitationUrl}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you did not expect this invitation, please ignore this email.</p>
      <br>
      <p>Best regards,</p>
      <p>The ${businessName} Team</p>
    `
  };
}

module.exports = {
  businessVerificationEmail,
  welcomeEmail,
  passwordResetEmail,
  teamInvitationEmail,
  loginNotificationEmail,
  subscriptionConfirmationEmail,
  teamMemberInvitationEmail
};