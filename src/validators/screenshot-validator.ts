import { isValidUrl } from "./url";
import { ScreenshotOptions } from "../types";

export interface ValidationResult {
    valid:boolean;
    data?: ScreenshotOptions;
    error?: string;
}

export function validateScreenshotOptions(body: any): ValidationResult {
    const { url, width, height, userAgent, authorizationHeader, cookies} = body;

    if(!url) return { valid: false, error: "URL is required"};
    if(!isValidUrl(url)) return {valid:false, error: "Invalid URL format"};

    if(width !== undefined) {
        const w= Number(width);
        if(isNaN(w) || w<320 || w>3840) {
            return {valid:false, error:"Width must be a number between 320 and 3840"};
        }
    }

    if (height !== undefined) {
        const h= Number(height);
        if(isNaN(h) || h<320 || h>3840) {
            return {valid:false, error:"Height must be a number beetween 320 and 3840"};
        }
    }
    if(userAgent && userAgent.length >500){
        return {valid: false, error: "User agent is too long (max 500 characters)"};        
    }
    if(authorizationHeader){
        if(authorizationHeader.length > 2000) {
            return {valid: false, error: "Authorization header is too long"};
        }
        if(!authorizationHeader.startsWith("Bearer") &&
           !authorizationHeader.startsWith("Basic")) {
            return {valid: false, error: "Authorization header must start with Bearer or Basic"};
        }
    }
    if (cookies && cookies.length > 4096) {
        return {valid: false, error: "Cookies string is too long (max 4096 characters)"};
    }
    return {
        valid: true,
        data: {
            url,
            width: width ? Number(width) : undefined,
            height: height ? Number(height) : undefined,
            fullPage: body.fullPage === true ||body.fullPage === "true",
            userAgent: userAgent,
            authorizationHeader: authorizationHeader,
            cookies: cookies,
        }
    };
}