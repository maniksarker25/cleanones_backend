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
        <img src="data:image/png;base64,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" alt="Cleanones" />
      </div>
      <div class="content">
        <h2>Welcome to Cleanones, ${name}!</h2>
        <p>Your client account has been created. You now have access to your Cleanones client portal, where you can track your cleaning plans, review upcoming and completed shifts, and stay in touch with your team.</p>

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
        <p>&copy; ${new Date().getFullYear()} Cleanones. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
`;

export default clientCredentialsEmailBody;
