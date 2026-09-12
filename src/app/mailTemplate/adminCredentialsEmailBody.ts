// adminCredentialsEmailBody.ts
const adminCredentialsEmailBody = (
    name: string,
    email: string,
    password: string
) => `
<html>
  <body style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#fff; padding:30px; border-radius:8px;">
      <h2>Admin Account Created</h2>
      <p>Hello <strong>${name}</strong>,</p>

      <p>Your admin account has been successfully created.  
      You can log in to the dashboard using the credentials below:</p>

      <div style="background:#f1f1f1; padding:15px; border-radius:6px;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
      </div>

      <p style="margin-top:20px;">
        🔐 For security reasons, please change your password after logging in.
      </p>

      <a
        href="https://windows-upgrade-dashboard.vercel.app"
        style="
          display:inline-block;
          margin-top:20px;
          padding:12px 25px;
          background:#007bff;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
        "
      >
        Login to Dashboard
      </a>

      <p style="margin-top:30px; font-size:14px; color:#888;">
        If you didn’t request this account, please contact support immediately.
      </p>
    </div>
  </body>
</html>
`;

export default adminCredentialsEmailBody;
