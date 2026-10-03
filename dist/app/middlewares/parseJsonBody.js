"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseJsonBody = (field = 'data') => (req, res, next) => {
    if (req.body[field]) {
        try {
            req.body = JSON.parse(req.body[field]);
        }
        catch (error) {
            return res
                .status(400)
                .json({ message: `${field} is not valid JSON` });
        }
    }
    next();
};
exports.default = parseJsonBody;
