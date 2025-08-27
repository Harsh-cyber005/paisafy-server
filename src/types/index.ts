export interface JwtPayload {
    email: string;
}

declare global {
    namespace Express {
        export interface Request {
            user?: JwtPayload;
        }
    }
}
