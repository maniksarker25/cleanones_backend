import { Resend } from 'resend';
import config from '../config';

const resend = new Resend(config.resend.api_key);

const sendEmail = async (options: {
    email: string;
    subject: string;
    html: string;
}) => {
    const { email, subject, html } = options;

    await resend.emails.send({
        from: `${config.smtp.name} <${config.resend.from_email}>`,
        to: email,
        subject,
        html,
    });
};

export default sendEmail;
