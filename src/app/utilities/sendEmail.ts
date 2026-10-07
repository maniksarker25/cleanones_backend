import { Resend } from 'resend';
import config from '../config';
import { LOGO_CID, logoBase64 } from '../mailTemplate/logo';

const resend = new Resend(config.resend.api_key);

const sendEmail = async (options: {
    email: string;
    subject: string;
    html: string;
}) => {
    const { email, subject, html } = options;

    // Inline (CID) attachment: Gmail does not render data: URI images.
    const attachments = html.includes(`cid:${LOGO_CID}`)
        ? [
              {
                  filename: 'logo.png',
                  content: logoBase64,
                  contentId: LOGO_CID,
                  contentType: 'image/png',
              },
          ]
        : undefined;

    await resend.emails.send({
        from: `${config.smtp.name} <${config.resend.from_email}>`,
        to: email,
        subject,
        html,
        attachments,
    });
};

export default sendEmail;
