/** 
* @param cookieString
* @param url 
*/
export function parseCookies(cookieString: string, url: string){
    if(!cookieString || cookieString.trim() === ""){
        return [];
    }
    const cookiePairs = cookieString.split(";");
    return cookiePairs.map(pair => {
        const trimmedPair = pair.trim();

        if(!trimmedPair) return null;
    
        const [name, ...valueParts] = trimmedPair.split("=");
        const value = valueParts.join("=");

        if(!name) return null;

        return {
            name: name.trim(),
            value: value.trim(),
            url: url,
            domain: new URL(url).hostname,
        };
    })
    .filter((cookie): cookie is {name: string; value: string; url: string; domain: string} => cookie !== null);
}