import { LOGO_CID } from './logo';

const clientCredentialsEmailBody = (
    name: string,
    email: string,
    password: string
) => `
<html>
  <head>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f0f4f8;
      }
      .container {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 173, 239, 0.12);
      }
      .header {
        padding: 32px 20px 20px;
        text-align: center;
        background-color: #ffffff;
        border-bottom: 1px solid #edf2f7;
      }
      .header img {
        height: 40px;
        width: auto;
      }
      .content {
        padding: 40px;
        color: #2d3748;
      }
      .content h2 {
        font-size: 22px;
        color: #1a202c;
        margin-bottom: 15px;
        font-weight: 600;
      }
      .content p {
        font-size: 16px;
        color: #4a5568;
        line-height: 1.7;
        margin-bottom: 20px;
      }
      .credentials-card {
        background-color: #f8faff;
        border: 1px solid #dceefc;
        border-radius: 8px;
        padding: 22px 24px;
        margin: 28px 0;
      }
      .credentials-card p {
        margin: 0 0 10px;
        font-size: 15px;
        color: #2d3748;
      }
      .credentials-card p:last-child {
        margin-bottom: 0;
      }
      .credentials-card .label {
        color: #718096;
        font-weight: 500;
      }
      .credentials-card .value {
        color: #1a202c;
        font-weight: 700;
      }
      .button-container {
        text-align: center;
        margin: 32px 0 8px;
      }
      .button {
        padding: 14px 40px;
        background-color: #00adef;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 50px;
        font-size: 16px;
        font-weight: 600;
        display: inline-block;
      }
      .notice {
        font-size: 14px;
        color: #718096;
      }
      .footer {
        padding: 28px 30px;
        font-size: 13px;
        color: #a0aec0;
        text-align: center;
        background-color: #fdfdfd;
        border-top: 1px solid #edf2f7;
      }
      .footer a {
        color: #00adef;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="cid:${LOGO_CID}" alt="CleanOnes" />
      </div>
      <div class="content">
        <h2>Welcome to CleanOnes, ${name}!</h2>
        <p>Your client account has been created. You now have access to your CleanOnes client portal, where you can track your cleaning plans, review upcoming and completed shifts, and stay in touch with your team.</p>

        <div class="credentials-card">
          <p><span class="label">Email:</span> <span class="value">${email}</span></p>
          <p><span class="label">Password:</span> <span class="value">${password}</span></p>
        </div>

        <p class="notice">For your security, we recommend changing your password after your first login.</p>

        <div class="button-container">
          <a href="https://cleanones-client-portal.vercel.app/" class="button">Log In to Your Portal</a>
        </div>
      </div>
      <div class="footer">
        <p>If you weren't expecting this account, please contact our support team right away.</p>
        <p>&copy; ${new Date().getFullYear()} CleanOnes. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
`;

export default clientCredentialsEmailBody;
