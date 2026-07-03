import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


const sendEmail = async ({to, subject, body}) => {
  console.log('Attempting to send email to:', to, 'with subject:', subject);
  console.log('SMTP User:', process.env.SMTP_USER ? 'Set' : 'NOT SET');
  console.log('Sender Email:', process.env.SENDER_EMAIL ? 'Set' : 'NOT SET');
  
  try {
    const response = await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to,
      subject,
      html: body,
    });
    console.log('Email sent successfully:', response.messageId);
    return response;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export default sendEmail;
