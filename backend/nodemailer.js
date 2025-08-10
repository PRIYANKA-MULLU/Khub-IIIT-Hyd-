const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "kadaripavani1@gmail.com",
    pass: "ahgb shfz qjpp eman",
  },
});

const mailOptions = {
  from: "kadaripavani1@gmail.com",
  to: "pannubangaram123@gmail.com",
  subject: "Test Email",
  text: "This is a test email.",
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("Error sending email:", error);
  } else {
    console.log("Email sent successfully:", info.response);
  }
});
