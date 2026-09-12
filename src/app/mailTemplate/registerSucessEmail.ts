export const registrationSuccessEmail = (
    name: string,
    activationCode: number
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
          font-size: 28px;
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
        .activation-card {
          background-color: #f8faff;
          border: 2px dashed #2B7FFF;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .activation-code {
          font-size: 36px;
          color: #2B7FFF;
          font-weight: 800;
          letter-spacing: 5px;
          margin: 0;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          padding: 14px 40px;
          background-color: #2B7FFF;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          display: inline-block;
          transition: background-color 0.3s ease;
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
        .warning {
          font-size: 13px;
          color: #e53e3e;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SnowOut</h1>
        </div>
        <div class="content">
          <h2>Welcome to the SnowOut, ${name}!</h2>

          <p>We're excited to have you on board. To get started with <strong>SnowOut</strong>, please verify your account using the activation code below:</p>
          
          <div class="activation-card">
            <div class="activation-code">${activationCode || 'XXXXXX'}</div>
          </div>

          <div class="button-container">
            <a href="https://snowout-app.com/activate" class="button">
              Verify Account
            </a>
          </div>

          <p class="warning">
            Note: This code expires in 10 minutes. For security, unverified accounts are automatically cleared from our system after this window.
          </p>
          
          <p>If you have any trouble, reach out to our team at <a href="mailto:support@snowout-app.com">support@snowout-app.com</a>.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} SnowOut. All rights reserved.</p>
          <p>
            <a href="https://snowout-app.com/privacy">Privacy Policy</a> | 
            <a href="https://snowout-app.com/contact">Support</a>
          </p>
        </div>
      </div>
    </body>
  </html>
`;

export default registrationSuccessEmail;
