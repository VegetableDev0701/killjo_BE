const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;

/**
 * Initialize email transporter
 * Creates Ethereal test account in development if no credentials are provided
 */
const initializeTransporter = async () => {
  // For development, if no email credentials, use Ethereal
  if (process.env.NODE_ENV === 'development' && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Created Ethereal test account:', testAccount.user);
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    return;
  }

  // Use configured SMTP settings
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
};

// Verify SMTP connection configuration
const verifyEmailConfig = async () => {
  try {
    if (!transporter) {
      await initializeTransporter();
    }
    await transporter.verify();
    console.log('SMTP server connection established successfully');
    return true;
  } catch (error) {
    console.error('SMTP server connection failed:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('Email configuration:', {
        host: transporter?.options?.host,
        port: transporter?.options?.port,
        secure: transporter?.options?.secure
      });
    }
    throw error;
  }
};

/**
 * Send an email using the configured SMTP transport
 * @param {string} to - Recipient email address
 * @param {Object} template - Email template object containing subject, html, and text
 * @returns {Promise} - Resolves when email is sent
 */
const sendEmail = async (to, template) => {
  try {
    if (!transporter) {
      await initializeTransporter();
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Nodo Platform <noreply@nodo.com>',
      to,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    // Log preview URL in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    // Add more detailed error logging
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
    }
    throw error;
  }
};

// Initialize transporter on module load
initializeTransporter().catch(console.error);

module.exports = {
  sendEmail,
  verifyEmailConfig
}; 