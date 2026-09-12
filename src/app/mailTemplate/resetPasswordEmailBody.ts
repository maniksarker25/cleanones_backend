export const resetPasswordEmailBody = (name: string, resetCode: number) => `
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
          box-shadow: 0 10px 25px rgba(43, 127, 255, 0.1);
        }
        .header {
          background-color: #2B7FFF;
          padding: 40px 20px;
          color: #ffffff;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
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
          margin-bottom: 25px;
        }
        .reset-card {
          background-color: #f8faff;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
        }
        .reset-code {
          font-size: 36px;
          color: #2B7FFF;
          font-weight: 800;
          letter-spacing: 6px;
          margin: 0;
        }
        .footer {
          padding: 30px;
          font-size: 13px;
          color: #a0aec0;
          text-align: center;
          background-color: #fdfdfd;
          border-top: 1px solid #edf2f7;
        }
        .footer a {
          color: #2B7FFF;
          text-decoration: none;
        }
        .support-link {
          color: #2B7FFF;
          text-decoration: none;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SnowOut</h1>
        </div>
        <div class="content">
          <h2>Password Reset</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset the password for your SnowOut account. Use the following code to complete the process:</p>
          
          <div class="reset-card">
            <div class="reset-code">${resetCode || 'XXXXXX'}</div>
          </div>

          <p>This code is valid for <strong>10 minutes</strong>. If you didn't request this change, you can safely ignore this email—your password will remain exactly as it is.</p>
          
          <p>Need a hand? Contact us at <a href="mailto:support@snowout-app.com" class="support-link">support@snowout-app.com</a>.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} SnowOut. All rights reserved.</p>
          <p>
            <a href="https://snowout-app.com/privacy">Privacy Policy</a> | 
            <a href="https://snowout-app.com/contact">Contact Us</a>
          </p>
        </div>
      </div>
    </body>
  </html>
`;

export default resetPasswordEmailBody;
