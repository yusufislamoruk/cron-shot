declare module 'blockhash' {
    export function blockhash(imgData: Buffer, bits: number, hashType: string): Promise<string>;
}