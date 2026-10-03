"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const sendEmail_1 = __importDefault(require("../utilities/sendEmail"));
const contactUsValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }),
        email: zod_1.z.string({ required_error: 'Email is required' }),
        phone: zod_1.z.string({ required_error: 'Phone number is required' }),
        message: zod_1.z.string({ required_error: 'Message is required' }),
    }),
});
const sendContactUsEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Validate the request body
        contactUsValidationSchema.parse(req);
        const { name, phone, email, message } = req.body;
        yield (0, sendEmail_1.default)({
            email: 'devsmanik@gmail.com',
            subject: 'Contact Us Info',
            html: `
        <h2>New Contact Us Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
        });
        res.status(200).json({ message: 'Contact email sent successfully' });
    }
    catch (error) {
        // Narrowing the error type
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        res.status(400).json({ error: errorMessage });
    }
});
exports.default = sendContactUsEmail;
