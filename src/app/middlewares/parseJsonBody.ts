import { NextFunction, Request, Response } from 'express';

const parseJsonBody =
    (field = 'data') =>
    (req: Request, res: Response, next: NextFunction) => {
        if (req.body[field]) {
            try {
                req.body = JSON.parse(req.body[field]);
            } catch (error) {
                return res
                    .status(400)
                    .json({ message: `${field} is not valid JSON` });
            }
        }
        next();
    };

export default parseJsonBody;
