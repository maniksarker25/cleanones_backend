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
exports.deleteFileFromS3 = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
// with version 3
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize the S3 client
const s3 = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const deleteFileFromS3 = (fileUrl) => __awaiter(void 0, void 0, void 0, function* () {
    // Extract the path after the domain
    const url = new URL(fileUrl);
    const fileKey = decodeURIComponent(url.pathname.substring(1)); // remove leading '/'
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) {
        throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
    }
    try {
        // Check if the file exists in S3
        const headCommand = new client_s3_1.HeadObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });
        try {
            yield s3.send(headCommand);
        }
        catch (err) {
            if (err.name === 'NotFound') {
                console.log(`File ${fileKey} does not exist in S3.`);
                return;
            }
            throw err;
        }
        // Delete the file
        const deleteCommand = new client_s3_1.DeleteObjectCommand({
            Bucket: bucket,
            Key: fileKey,
        });
        yield s3.send(deleteCommand);
        console.log(`Successfully deleted ${fileKey} from S3`);
    }
    catch (err) {
        if (err.name === 'NotFound') {
            console.error(`File ${fileKey} was not found in S3.`);
        }
        else {
            console.error('Error deleting file from S3:', err);
        }
    }
});
exports.deleteFileFromS3 = deleteFileFromS3;
