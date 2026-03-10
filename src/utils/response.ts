export function errorResponse(message: string, status: number){
    return {
        status: status,
        body: {
            error: message
        }
    };
}