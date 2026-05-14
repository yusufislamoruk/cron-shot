import { blockhash } from 'blockhash';
import { Buffer } from 'buffer';

export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
    const hash = await blockhash(imageBuffer, 16, 'hex');
    return hash;
}

export function hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) throw new Error('Hash length mismatch');
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
}

export function imagesAreSimilar(hash1: string, hash2: string, threshold: number = 10): boolean {
    return hammingDistance(hash1, hash2) < threshold;
}
