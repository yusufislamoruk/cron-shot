import sharp from 'sharp';
import { Buffer } from 'buffer';

export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
    // sharp ile PNG'yi grayscale RGBA'ya çevir
    const { data, info } = await sharp(imageBuffer)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels: number[] = [];
    for (let i = 0; i < data.length; i++) {
        pixels.push(data[i]);
    }

    // Basit average hash algoritması
    const size = 8;
    const blockSize = Math.floor(info.width / size);
    let hash = '';

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            let blockSum = 0;
            let count = 0;

            for (let y = row * blockSize; y < (row + 1) * blockSize && y < info.height; y++) {
                for (let x = col * blockSize; x < (col + 1) * blockSize && x < info.width; x++) {
                    blockSum += pixels[y * info.width + x];
                    count++;
                }
            }

            const avg = blockSum / count;
            hash += avg > 128 ? '1' : '0';
        }
    }

    // Hex'e çevir (her 4 bit = 1 hex digit, 128 bit / 4 = 32 hex)
    let hexHash = '';
    for (let i = 0; i < hash.length; i += 4) {
        hexHash += parseInt(hash.slice(i, i + 4), 2).toString(16);
    }

    return hexHash;
}

export function hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) throw new Error('Hash length mismatch');
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        const n1 = parseInt(hash1[i], 16);
        const n2 = parseInt(hash2[i], 16);
        let xor = n1 ^ n2;
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
}

export function imagesAreSimilar(hash1: string, hash2: string, threshold: number = 5): boolean {
    return hammingDistance(hash1, hash2) < threshold;
}
