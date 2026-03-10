export function isValidUrl(input:string):boolean{
    if(!input) return false;

    try {
        const url = new URL(input);

        if(url.protocol !== "http:" && url.protocol !=="https:"){
            return false;
        }
        return true;
    }
    catch (error){
        return false;
    }
}